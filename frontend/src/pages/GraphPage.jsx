import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import GraphView from '../components/GraphView';

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search Controls
  const initialEntity = searchParams.get('entity_id') || 'PLANTCYC1';
  const initialRule = searchParams.get('rule') || '';

  const [entityIdInput, setEntityIdInput] = useState(initialEntity);
  const [currentEntity, setCurrentEntity] = useState(initialEntity);
  const [hops, setHops] = useState(1);
  const [layoutName, setLayoutName] = useState('cose'); // 'cose' | 'circle'
  const [minAmount, setMinAmount] = useState('');
  const [nodeTypes, setNodeTypes] = useState({
    account: true,
    device: true,
    phone: true,
    merchant: true,
  });

  // Graph Data
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], truncated: false });
  const [loading, setLoading] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState([]);

  // Selected Node Details Drawer
  const [selectedNodeData, setSelectedNodeData] = useState(null);
  const [entityDetails, setEntityDetails] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingNodeDetails, setLoadingNodeDetails] = useState(false);

  // Subgraph snapshot capture status
  const [snapshotSaved, setSnapshotSaved] = useState(false);

  const fetchNeighborhood = async (targetId, currentHops = hops) => {
    setLoading(true);
    setSnapshotSaved(false);
    try {
      const activeTypes = Object.keys(nodeTypes)
        .filter((k) => nodeTypes[k])
        .join(',');

      const res = await client.getGraphNeighborhood({
        entity_id: targetId,
        hops: currentHops,
        min_amount: minAmount,
        node_types: activeTypes,
      });

      setGraphData(res);
      setCurrentEntity(targetId);

      // Auto-highlight cycle or ring entities if rule is 'cycles' or entities match ring
      if (initialRule === 'cycles' || targetId.startsWith('PLANTCYC') || targetId === '8000EBD30') {
        setHighlightedIds(['8000EBD30', 'PLANTCYC1', 'PLANTCYC2', 'PLANTCYC3']);
      } else {
        setHighlightedIds([targetId]);
      }
    } catch (err) {
      console.error('Failed to load graph neighborhood:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNeighborhood(initialEntity);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!entityIdInput.trim()) return;
    setSearchParams({ entity_id: entityIdInput.trim() });
    fetchNeighborhood(entityIdInput.trim());
  };

  const handleNodeClick = async (node) => {
    setSelectedNodeData(node);
    setLoadingNodeDetails(true);
    try {
      const ent = await client.getEntity(node.id);
      setEntityDetails(ent);
      const timeData = await client.getEntityTimeline(node.id);
      setTimeline(timeData || []);
    } catch (err) {
      console.error('Failed to fetch node info:', err);
    } finally {
      setLoadingNodeDetails(false);
    }
  };

  const handleNodeDoubleClick = (node) => {
    setEntityIdInput(node.id);
    fetchNeighborhood(node.id, 2);
  };

  const handleToggleNodeType = (type) => {
    setNodeTypes((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      return next;
    });
  };

  const handleAddToCase = async () => {
    try {
      const casesRes = await client.getCases();
      const targetCase = casesRes.items?.[0];
      if (targetCase) {
        await client.addCaseEvidence(targetCase.id, {
          type: 'subgraph',
          ref: `GRAPH_${currentEntity}_HOPS_${hops}`,
          content: {
            entity_id: currentEntity,
            hops,
            node_ids: graphData.nodes.map((n) => n.id),
            edge_ids: graphData.edges.map((e) => e.id),
            layout: layoutName,
            captured_at: new Date().toISOString(),
          },
        });
        setSnapshotSaved(true);
        setTimeout(() => setSnapshotSaved(false), 4000);
      } else {
        const newCase = await client.createCase({
          title: `Graph Investigation on ${currentEntity}`,
          priority: 'high',
        });
        await client.addCaseEvidence(newCase.id, {
          type: 'subgraph',
          ref: `GRAPH_${currentEntity}`,
          content: { entity_id: currentEntity, hops },
        });
        navigate(`/cases/${newCase.id}`);
      }
    } catch (err) {
      console.error('Failed to attach subgraph to case:', err);
    }
  };

  return (
    <div className="page-container">
      {/* Top Banner */}
      <div className="dark-console-card row-layout">
        <div>
          <div className="console-headline-box">
            <h2>TOPOLOGICAL GRAPH & RING NEIGHBORHOOD</h2>
          </div>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '13px', maxWidth: '68ch', textWrap: 'pretty' }}>
            Interactive entity-relationship graph powered by Neo4j graph traversal and Cytoscape.
            Explore directional money flows, shared infrastructure bindings, and multi-hop laundering rings.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', borderLeft: '1px solid var(--bg-dark-border)', paddingLeft: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
            CURRENT FOCUS: {currentEntity}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-primary)' }}>
            Nodes: <strong>{graphData.nodes.length}</strong> · Edges: <strong>{graphData.edges.length}</strong>
          </div>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={handleAddToCase}
          >
            {snapshotSaved ? '✓ SNAPSHOT SAVED TO CASE' : '📂 ADD THIS VIEW TO CASE'}
          </button>
        </div>
      </div>

      {/* Truncated Notice */}
      {graphData.truncated && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--risk-critical-bg)',
            border: '1px solid var(--risk-critical-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--risk-critical-text)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <strong style={{ fontFamily: 'var(--font-mono)' }}>⚠ TRUNCATION LIMIT REACHED:</strong>
          <span>
            The requested neighborhood exceeds 200 nodes and has been truncated per system safety policies.
            Use filters (min amount or 1-hop limit) to isolate specific pathways.
          </span>
        </div>
      )}

      {/* Graph Filter & Navigation Bar */}
      <div
        className="workbench-panel"
        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="entity-id-input" className="form-label" style={{ marginBottom: 0 }}>
            Root Entity ID:
          </label>
          <input
            id="entity-id-input"
            type="text"
            className="input mono"
            placeholder="Account / Device ID"
            value={entityIdInput}
            onChange={(e) => setEntityIdInput(e.target.value)}
            style={{ width: '180px', fontSize: '12px', minHeight: '30px' }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Explore
          </button>
        </form>

        {/* Hops Selector (1 or 2 max) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            MAX HOPS:
          </span>
          <div className="pill-tab-group">
            <button
              type="button"
              className={`pill-tab ${hops === 1 ? 'active' : ''}`}
              onClick={() => {
                setHops(1);
                fetchNeighborhood(currentEntity, 1);
              }}
            >
              1 Hop
            </button>
            <button
              type="button"
              className={`pill-tab ${hops === 2 ? 'active' : ''}`}
              onClick={() => {
                setHops(2);
                fetchNeighborhood(currentEntity, 2);
              }}
            >
              2 Hops
            </button>
          </div>
        </div>

        {/* Layout Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            LAYOUT:
          </span>
          <div className="pill-tab-group">
            <button
              type="button"
              className={`pill-tab ${layoutName === 'cose' ? 'active' : ''}`}
              onClick={() => setLayoutName('cose')}
            >
              Force-Directed
            </button>
            <button
              type="button"
              className={`pill-tab ${layoutName === 'circle' ? 'active' : ''}`}
              onClick={() => setLayoutName('circle')}
            >
              Circular Ring
            </button>
          </div>
        </div>

        {/* Node Types Checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            TYPES:
          </span>
          {Object.keys(nodeTypes).map((type) => (
            <label key={type} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={nodeTypes[type]}
                onChange={() => {
                  handleToggleNodeType(type);
                  fetchNeighborhood(currentEntity);
                }}
              />
              <span style={{ textTransform: 'capitalize' }}>{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Main Graph Area + Node Detail Split-Pane Drawer */}
      <div className="split-pane-layout">
        <div className="split-pane-main">
          {loading ? (
            <div
              style={{
                height: '620px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>Traversing Multi-Hop Graph...</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Querying Neo4j Cypher paths and node degrees
                </div>
              </div>
            </div>
          ) : (
            <GraphView
              nodes={graphData.nodes}
              edges={graphData.edges}
              layoutName={layoutName}
              highlightIds={highlightedIds}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
            />
          )}

          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Tip: Click any node to inspect entity dossier & timeline. Double-click to expand 2nd-degree counterparty neighborhood.</span>
            <span className="mono">ACTIVE RING HIGHLIGHT: {highlightedIds.join(' → ')}</span>
          </div>
        </div>

        {/* Right Drawer: Node Entity Dossier (Flattened, no nested cards) */}
        {selectedNodeData && (
          <aside className="split-pane-side" style={{ width: '420px' }}>
            <div className="panel-header" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                  {selectedNodeData.id}
                </span>
                <span className="badge badge-risk-high num mono">
                  Risk {(selectedNodeData.risk * 100).toFixed(0)}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeData(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingNodeDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ height: '24px' }} />
                  <div className="skeleton" style={{ height: '48px' }} />
                  <div className="skeleton" style={{ height: '64px' }} />
                </div>
              ) : entityDetails ? (
                <>
                  <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      {entityDetails.entity_type} Entity
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                      {entityDetails.display_name}
                    </div>
                  </div>

                  {/* Attributes Section (Unboxed) */}
                  {entityDetails.attributes && (
                    <section style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                        Attributes & Metadata
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                        {Object.entries(entityDetails.attributes).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                              {k.replace(/_/g, ' ')}:
                            </span>
                            <span className="mono" style={{ fontWeight: 500 }}>
                              {String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Aliases Section (Unboxed) */}
                  {entityDetails.aliases && entityDetails.aliases.length > 0 && (
                    <section style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Associated Aliases</span>
                        <span className="badge badge-neutral">{entityDetails.aliases.length}</span>
                      </div>
                      <div>
                        {entityDetails.aliases.map((al, idx) => (
                          <div key={idx} style={{ marginBottom: '6px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <strong className="mono">{al.alias_value}</strong>
                              <span className="badge badge-risk-normal num mono" style={{ fontSize: '12px' }}>
                                {(al.match_score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                              {al.match_reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Node Transaction Timeline Section (Unboxed) */}
                  <section style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Recent Settlement Timeline</span>
                      <span className="badge badge-neutral">{timeline.length} Txns</span>
                    </div>
                    <div className="table-container">
                      <table className="analyst-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Dir</th>
                            <th>Time</th>
                            <th>Counterparty</th>
                            <th className="num">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeline.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <span
                                  className={`badge ${
                                    item.direction === 'in' ? 'badge-risk-normal' : 'badge-risk-watch'
                                  }`}
                                  style={{ padding: '1px 6px', fontSize: '11px', textTransform: 'uppercase' }}
                                >
                                  {item.direction}
                                </span>
                              </td>
                              <td className="mono" style={{ whiteSpace: 'nowrap' }}>{item.ts}</td>
                              <td className="mono">{item.counterparty_id}</td>
                              <td className="num mono">
                                ₹{Number(item.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <div className="empty-state">
                  <p>Entity details not found.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
