import axios from 'axios';

// Mock fixtures
import uploadMock from './mocks/upload.json';
import ingestionMock from './mocks/ingestion.json';
import alertsMock from './mocks/alerts.json';
import alertDetailMock from './mocks/alert_detail.json';
import graphMock from './mocks/graph.json';
import casesMock from './mocks/cases.json';
import rulesMock from './mocks/rules.json';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// Default to true when VITE_USE_MOCKS is 'true' or not explicitly false
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

const http = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-memory mock store clones to allow dynamic demo updates
let mockAlerts = JSON.parse(JSON.stringify(alertsMock));
let mockAlertDetails = JSON.parse(JSON.stringify(alertDetailMock));
let mockCases = JSON.parse(JSON.stringify(casesMock));
let mockRules = JSON.parse(JSON.stringify(rulesMock));
let mockIngestion = JSON.parse(JSON.stringify(ingestionMock));
let mockGraph = JSON.parse(JSON.stringify(graphMock));

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export const client = {
  isMockMode: () => USE_MOCKS,

  // Health
  getHealth: async () => {
    if (USE_MOCKS) {
      await delay(80);
      return { status: 'ok', postgres: true, neo4j: true, mock_mode: true };
    }
    const res = await http.get('/health');
    return res.data;
  },

  // Ingestion
  uploadFile: async (formData) => {
    if (USE_MOCKS) {
      await delay(250);
      return uploadMock;
    }
    const res = await http.post('/api/ingestion/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  saveMapping: async (batchId, mapping) => {
    if (USE_MOCKS) {
      await delay(150);
      return { batch_id: batchId, status: 'pending', mapping };
    }
    const res = await http.post(`/api/ingestion/${batchId}/mapping`, { mapping });
    return res.data;
  },

  getMappingTemplates: async () => {
    if (USE_MOCKS) {
      await delay(100);
      return mockIngestion.templates;
    }
    const res = await http.get('/api/ingestion/mappings/templates');
    return res.data;
  },

  saveMappingTemplate: async (name, mapping) => {
    if (USE_MOCKS) {
      await delay(150);
      const newTpl = { id: `TPL_${Date.now()}`, name, mapping };
      mockIngestion.templates.push(newTpl);
      return newTpl;
    }
    const res = await http.post('/api/ingestion/mappings/templates', { name, mapping });
    return res.data;
  },

  runIngestion: async (batchId) => {
    if (USE_MOCKS) {
      await delay(200);
      return { task_id: `TASK_INGEST_${Date.now()}`, batch_id: batchId };
    }
    const res = await http.post(`/api/ingestion/${batchId}/run`);
    return res.data;
  },

  getIngestionStatus: async (batchId) => {
    if (USE_MOCKS) {
      await delay(100);
      return {
        batch_id: batchId,
        status: mockIngestion.status,
        row_count: mockIngestion.row_count,
        valid_count: mockIngestion.valid_count,
        invalid_count: mockIngestion.invalid_count,
        report: mockIngestion.report,
      };
    }
    const res = await http.get(`/api/ingestion/${batchId}`);
    return res.data;
  },

  getProvenance: async (batchId, recordType = 'transaction', recordId = 'TXN_7701') => {
    if (USE_MOCKS) {
      await delay(100);
      return mockIngestion.provenance[recordId] || mockIngestion.provenance['TXN_7701'];
    }
    const res = await http.get(`/api/ingestion/${batchId}/provenance`, {
      params: { record_type: recordType, record_id: recordId },
    });
    return res.data;
  },

  getBatchEntities: async (batchId) => {
    if (USE_MOCKS) {
      await delay(100);
      return mockIngestion.entities;
    }
    // Fallback: endpoint defined in api-gaps.md
    try {
      const res = await http.get(`/api/ingestion/${batchId}/entities`);
      return res.data;
    } catch {
      return mockIngestion.entities;
    }
  },

  // Graph Build & Detection Tasks
  buildGraph: async () => {
    if (USE_MOCKS) {
      await delay(150);
      return { task_id: `TASK_GRAPH_${Date.now()}` };
    }
    const res = await http.post('/api/graph/build');
    return res.data;
  },

  runDetection: async (rules = ['shared_infra', 'rapid_movement', 'cycles', 'fan_in_out']) => {
    if (USE_MOCKS) {
      await delay(150);
      return { task_id: `TASK_DETECT_${Date.now()}` };
    }
    const res = await http.post('/api/detect/run', { rules });
    return res.data;
  },

  getTask: async (taskId) => {
    if (USE_MOCKS) {
      await delay(80);
      return { state: 'SUCCESS', result: { message: 'Completed successfully' } };
    }
    const res = await http.get(`/api/tasks/${taskId}`);
    return res.data;
  },

  // Alerts
  getAlerts: async ({ status = '', rule_id = '', min_score = '', limit = 50, offset = 0 } = {}) => {
    if (USE_MOCKS) {
      await delay(100);
      let items = [...mockAlerts.items];
      if (status) items = items.filter((a) => a.status === status);
      if (rule_id) items = items.filter((a) => a.rule_id === rule_id);
      if (min_score) items = items.filter((a) => a.score >= parseFloat(min_score));
      return {
        total: items.length,
        items: items.slice(offset, offset + limit),
      };
    }
    const res = await http.get('/api/alerts', {
      params: { status, rule_id, min_score, limit, offset },
    });
    return res.data;
  },

  getAlert: async (id) => {
    if (USE_MOCKS) {
      await delay(120);
      const detail = mockAlertDetails[id] || mockAlertDetails['ALT-2026-0091'];
      return detail;
    }
    const res = await http.get(`/api/alerts/${id}`);
    return res.data;
  },

  postAlertFeedback: async (id, verdict, note = '') => {
    if (USE_MOCKS) {
      await delay(150);
      const alert = mockAlerts.items.find((a) => a.id === id);
      if (alert) {
        alert.status = verdict === 'false_positive' ? 'false_positive' : 'confirmed';
      }
      if (mockAlertDetails[id]) {
        mockAlertDetails[id].status = alert ? alert.status : verdict;
      }
      // Also update rules feedback stats for dynamic loop reflection
      if (verdict === 'false_positive' && alert) {
        const stat = mockRules.stats.by_rule.find((r) => r.rule_id === alert.rule_id);
        if (stat) {
          stat.false_positives += 1;
          stat.fp_rate = parseFloat((stat.false_positives / stat.alerts).toFixed(4));
        }
      }
      return { alert_id: id, status: verdict };
    }
    const res = await http.post(`/api/alerts/${id}/feedback`, { verdict, note });
    return res.data;
  },

  // Graph Neighborhood & Entities
  getGraphNeighborhood: async ({
    entity_id = '8000EBD30',
    hops = 1,
    start = '',
    end = '',
    min_amount = '',
    node_types = 'account,device,phone,merchant',
  } = {}) => {
    if (USE_MOCKS) {
      await delay(150);
      const allowedTypes = node_types.split(',').map((t) => t.trim());
      let filteredNodes = mockGraph.neighborhood.nodes.filter((n) => allowedTypes.includes(n.type));
      if (min_amount) {
        const minVal = parseFloat(min_amount);
        // Include non-account nodes or edges above min amount
        const relevantEdges = mockGraph.neighborhood.edges.filter((e) => e.amount >= minVal || e.amount === 0);
        const nodeIds = new Set(relevantEdges.flatMap((e) => [e.source, e.target]));
        filteredNodes = filteredNodes.filter((n) => nodeIds.has(n.id) || n.id === entity_id);
      }
      return {
        nodes: filteredNodes,
        edges: mockGraph.neighborhood.edges,
        truncated: mockGraph.neighborhood.truncated,
      };
    }
    const res = await http.get('/api/graph/neighborhood', {
      params: { entity_id, hops, start, end, min_amount, node_types },
    });
    return res.data;
  },

  getEntity: async (id) => {
    if (USE_MOCKS) {
      await delay(100);
      return mockGraph.entity_details[id] || {
        id,
        entity_type: 'account',
        display_name: `Entity ${id}`,
        attributes: { risk_level: 'High' },
        aliases: [],
      };
    }
    const res = await http.get(`/api/entities/${id}`);
    return res.data;
  },

  getEntityTimeline: async (id, { start = '', end = '' } = {}) => {
    if (USE_MOCKS) {
      await delay(100);
      return mockGraph.timelines[id] || mockGraph.timelines['8000EBD30'] || [];
    }
    const res = await http.get(`/api/entities/${id}/timeline`, { params: { start, end } });
    return res.data;
  },

  // Cases
  getCases: async ({ status = '', assignee = '' } = {}) => {
    if (USE_MOCKS) {
      await delay(100);
      let items = [...mockCases.items];
      if (status) items = items.filter((c) => c.status === status);
      if (assignee) items = items.filter((c) => c.assignee.includes(assignee));
      return { total: items.length, items };
    }
    const res = await http.get('/api/cases', { params: { status, assignee } });
    return res.data;
  },

  createCase: async ({ title, alert_ids = [], priority = 'medium' }) => {
    if (USE_MOCKS) {
      await delay(180);
      const newId = `CASE-2026-${String(mockCases.items.length + 1).padStart(3, '0')}`;
      const newCase = {
        id: newId,
        title,
        status: 'open',
        priority,
        created_at: new Date().toLocaleString('en-GB'),
        alert_ids,
        assignee: 'Current Analyst',
      };
      mockCases.items.unshift(newCase);
      mockCases.details[newId] = {
        ...newCase,
        evidence: alert_ids.map((aid) => ({
          id: `EV-${Date.now()}`,
          type: 'alert',
          ref: aid,
          content: { description: `Linked initial alert ${aid}` },
          created_at: new Date().toLocaleString('en-GB'),
        })),
        tasks: [
          {
            id: `TSK-${Date.now()}`,
            title: 'Initial intake and counterparty verification',
            assignee: 'Current Analyst',
            due_date: 'Tomorrow 17:00',
            status: 'open',
          },
        ],
        decisions: [],
        summary: `New case initiated for ${alert_ids.length} suspicious alerts under ${priority} priority.`,
        audit: [
          {
            ts: new Date().toLocaleString('en-GB'),
            user: 'Current Analyst',
            action: 'CASE_CREATED',
            detail: `Created case with alerts ${alert_ids.join(', ')}`,
          },
        ],
      };
      return newCase;
    }
    const res = await http.post('/api/cases', { title, alert_ids, priority });
    return res.data;
  },

  getCase: async (id) => {
    if (USE_MOCKS) {
      await delay(120);
      const c = mockCases.details[id] || mockCases.details['CASE-2026-001'];
      return c;
    }
    const res = await http.get(`/api/cases/${id}`);
    return res.data;
  },

  addCaseEvidence: async (id, { type, ref, content }) => {
    if (USE_MOCKS) {
      await delay(150);
      const ev = {
        id: `EV-${Date.now()}`,
        type,
        ref,
        content,
        created_at: new Date().toLocaleString('en-GB'),
      };
      if (mockCases.details[id]) {
        mockCases.details[id].evidence.push(ev);
        mockCases.details[id].audit.push({
          ts: new Date().toLocaleString('en-GB'),
          user: 'Current Analyst',
          action: 'EVIDENCE_ATTACHED',
          detail: `Attached ${type} (${ref})`,
        });
      }
      return ev;
    }
    const res = await http.post(`/api/cases/${id}/evidence`, { type, ref, content });
    return res.data;
  },

  addCaseTask: async (id, { title, assignee, due_date }) => {
    if (USE_MOCKS) {
      await delay(120);
      const task = {
        id: `TSK-${Date.now()}`,
        title,
        assignee,
        due_date,
        status: 'open',
      };
      if (mockCases.details[id]) {
        mockCases.details[id].tasks.push(task);
        mockCases.details[id].audit.push({
          ts: new Date().toLocaleString('en-GB'),
          user: 'Current Analyst',
          action: 'TASK_ADDED',
          detail: `Added task: ${title}`,
        });
      }
      return task;
    }
    const res = await http.post(`/api/cases/${id}/tasks`, { title, assignee, due_date });
    return res.data;
  },

  patchTask: async (taskId, { status }) => {
    if (USE_MOCKS) {
      await delay(100);
      for (const c of Object.values(mockCases.details)) {
        const t = c.tasks.find((task) => task.id === taskId);
        if (t) {
          t.status = status;
          c.audit.push({
            ts: new Date().toLocaleString('en-GB'),
            user: 'Current Analyst',
            action: 'TASK_UPDATED',
            detail: `Task ${taskId} marked as ${status}`,
          });
          return t;
        }
      }
      return { id: taskId, status };
    }
    const res = await http.patch(`/api/tasks/${taskId}`, { status });
    return res.data;
  },

  recordCaseDecision: async (id, { decision, rationale }) => {
    if (USE_MOCKS) {
      await delay(180);
      const dec = {
        id: `DEC-${Date.now()}`,
        decision,
        rationale,
        decider: 'Current Analyst (Senior Investigator)',
        created_at: new Date().toLocaleString('en-GB'),
      };
      if (mockCases.details[id]) {
        mockCases.details[id].decisions.push(dec);
        mockCases.details[id].status = decision === 'confirmed_fraud' ? 'closed' : 'in_review';
        mockCases.details[id].audit.push({
          ts: new Date().toLocaleString('en-GB'),
          user: 'Current Analyst',
          action: 'DECISION_RECORDED',
          detail: `Recorded ${decision}: ${rationale.slice(0, 50)}...`,
        });
      }
      return dec;
    }
    const res = await http.post(`/api/cases/${id}/decision`, { decision, rationale });
    return res.data;
  },

  getCaseSummary: async (id) => {
    if (USE_MOCKS) {
      await delay(100);
      const c = mockCases.details[id] || mockCases.details['CASE-2026-001'];
      return { summary: c.summary };
    }
    const res = await http.get(`/api/cases/${id}/summary`);
    return res.data;
  },

  // Rules and Feedback
  getRules: async () => {
    if (USE_MOCKS) {
      await delay(100);
      return mockRules.rules;
    }
    const res = await http.get('/api/rules');
    return res.data;
  },

  patchRule: async (ruleId, { weight, enabled, params }) => {
    if (USE_MOCKS) {
      await delay(150);
      const r = mockRules.rules.find((rule) => rule.rule_id === ruleId);
      if (r) {
        if (weight !== undefined) r.weight = weight;
        if (enabled !== undefined) r.enabled = enabled;
        if (params !== undefined) r.params = { ...r.params, ...params };
        return r;
      }
      return { rule_id: ruleId, weight, enabled, params };
    }
    const res = await http.patch(`/api/rules/${ruleId}`, { weight, enabled, params });
    return res.data;
  },

  getFeedbackStats: async () => {
    if (USE_MOCKS) {
      await delay(100);
      return mockRules.stats;
    }
    const res = await http.get('/api/feedback/stats');
    return res.data;
  },
};
