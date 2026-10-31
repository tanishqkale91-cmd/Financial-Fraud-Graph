import React, { useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';

const CYTO_STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'font-size': '11px',
      'font-family': 'ui-sans-serif, system-ui, sans-serif',
      color: '#0f172a',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'text-background-opacity': 0.85,
      'text-background-color': '#f5f3ec',
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      width: 42,
      height: 42,
      'border-width': 3,
      'border-color': '#475569',
      'background-color': '#ffffff',
    },
  },
  {
    selector: 'node[type = "account"]',
    style: {
      shape: 'ellipse',
      'background-color': '#1e293b',
      'border-color': '#0f172a',
      color: '#0f172a',
    },
  },
  {
    selector: 'node[type = "device"]',
    style: {
      shape: 'diamond',
      'background-color': '#0284c7',
      'border-color': '#0369a1',
      width: 38,
      height: 38,
    },
  },
  {
    selector: 'node[type = "phone"]',
    style: {
      shape: 'hexagon',
      'background-color': '#d97706',
      'border-color': '#b45309',
      width: 38,
      height: 38,
    },
  },
  {
    selector: 'node[type = "merchant"]',
    style: {
      shape: 'round-rectangle',
      'background-color': '#64748b',
      'border-color': '#334155',
      width: 44,
      height: 34,
    },
  },
  // Risk Border Encoding
  {
    selector: 'node[risk >= 0.85]',
    style: {
      'border-color': '#dc2626',
      'border-width': 5,
    },
  },
  {
    selector: 'node[risk >= 0.7][risk < 0.85]',
    style: {
      'border-color': '#d97706',
      'border-width': 4,
    },
  },
  {
    selector: 'node[risk < 0.7]',
    style: {
      'border-color': '#10b981',
      'border-width': 2,
    },
  },
  // Highlighted in Ring / Cycle
  {
    selector: 'node.highlighted',
    style: {
      'border-color': '#f59e0b',
      'border-width': 6,
      'underlay-color': '#f59e0b',
      'underlay-padding': '4px',
      'underlay-opacity': 0.3,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#94a3b8',
      'target-arrow-color': '#64748b',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.2,
      label: 'data(label)',
      'font-size': '10px',
      'font-family': 'JetBrains Mono, monospace',
      color: '#475569',
      'text-rotation': 'autorotate',
      'text-background-opacity': 0.9,
      'text-background-color': '#ffffff',
      'text-background-padding': '2px',
    },
  },
  {
    selector: 'edge[amount > 0]',
    style: {
      width: 3,
      'line-color': '#64748b',
    },
  },
  {
    selector: 'edge[amount > 300000]',
    style: {
      width: 5,
      'line-color': '#b91c1c',
      'target-arrow-color': '#b91c1c',
    },
  },
  {
    selector: 'edge.highlighted',
    style: {
      width: 5,
      'line-color': '#f59e0b',
      'target-arrow-color': '#f59e0b',
    },
  },
];

export default function GraphView({
  nodes = [],
  edges = [],
  layoutName = 'cose',
  highlightIds = [],
  onNodeClick,
  onNodeDoubleClick,
}) {
  const cyRef = useRef(null);

  // Transform raw nodes & edges into Cytoscape elements
  const elements = [
    ...nodes.map((n) => {
      const isHighlighted = highlightIds.includes(n.id);
      return {
        data: {
          id: n.id,
          label: n.label || n.id,
          type: n.type || 'account',
          risk: n.risk || 0,
        },
        classes: isHighlighted ? 'highlighted' : '',
      };
    }),
    ...edges.map((e) => {
      const isHighlighted =
        highlightIds.includes(e.source) && highlightIds.includes(e.target);
      const formattedAmount =
        e.amount > 0
          ? `₹${(e.amount / 1000).toFixed(0)}k`
          : e.type || '';
      return {
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          amount: e.amount || 0,
          type: e.type,
          label: formattedAmount,
        },
        classes: isHighlighted ? 'highlighted' : '',
      };
    }),
  ];

  const layout = {
    name: layoutName === 'circle' ? 'circle' : 'cose',
    animate: false,
    fit: true,
    padding: 30,
    nodeDimensionsIncludeLabels: true,
  };

  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.resize();
      cyRef.current.layout(layout).run();
    }
  }, [elements.length, layoutName]);

  return (
    <div
      style={{
        width: '100%',
        height: '620px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={CYTO_STYLE}
        layout={layout}
        cy={(cy) => {
          cyRef.current = cy;

          cy.removeAllListeners();

          cy.on('tap', 'node', (evt) => {
            const nodeData = evt.target.data();
            if (onNodeClick) onNodeClick(nodeData);
          });

          cy.on('dbltap', 'node', (evt) => {
            const nodeData = evt.target.data();
            if (onNodeDoubleClick) onNodeDoubleClick(nodeData);
          });
        }}
      />

      {/* Floating Zoom / Center Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
          title="Zoom In"
          style={{ width: '32px', height: '32px', padding: 0 }}
        >
          +
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
          title="Zoom Out"
          style={{ width: '32px', height: '32px', padding: 0 }}
        >
          -
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => cyRef.current?.fit()}
          title="Center & Fit View"
          style={{ width: '32px', height: '32px', padding: 0, fontSize: '11px' }}
        >
          ⛶
        </button>
      </div>

      {/* Legend Badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px',
          display: 'flex',
          gap: '12px',
          zIndex: 10,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#1e293b' }} />
          <span>Account</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', backgroundColor: '#0284c7' }} />
          <span>Device</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#d97706' }} />
          <span>Phone</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '8px', borderRadius: '2px', backgroundColor: '#64748b' }} />
          <span>Merchant</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--border-default)', paddingLeft: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #dc2626' }} />
          <span>Critical Risk</span>
        </div>
      </div>
    </div>
  );
}
