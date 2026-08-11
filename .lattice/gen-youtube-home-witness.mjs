import { writeFileSync } from 'node:fs';
import {
  canonicalizeTodoArtifact,
  todoSelfDigest,
} from 'file:///Users/kite/Developer/Lattice/src/todo-contracts.mjs';

const witness = ({ output, reads, queryId }) => ({
  owns: [{ kind: 'path', target: output, creates: true }],
  reads,
  writes: [output],
  resources: [],
  state_effects: [],
  sensor_provenance: {
    queries: [{
      query_id: queryId,
      expect: { kind: 'affected', path: output },
    }],
  },
  affected_tests: [],
  unknowns: [],
});

const witnessSet = {
  schema: 'lattice.todo_witness_set.v5',
  project_id: 'ChromeBlocker',
  plan_key: 'nope-youtube-home',
  capacity: { executors: 2 },
  sensor_query_set: {
    queries: [
      {
        id: 'survey-output',
        operation: 'affected',
        target: 'docs/survey/youtube-home-search.md',
      },
      {
        id: 'flow-audit-output',
        operation: 'affected',
        target: 'docs/evidence/youtube-flow-audit.md',
      },
      { id: 'repo-status', operation: 'status' },
    ],
  },
  manual_witness: {
    'yt-dom-survey': witness({
      output: 'docs/survey/youtube-home-search.md',
      reads: [
        'docs/plan_nope-youtube-home.md',
        'docs/survey/media-sites.md',
      ],
      queryId: 'survey-output',
    }),
    'yt-flow-audit': witness({
      output: 'docs/evidence/youtube-flow-audit.md',
      reads: [
        'README.md',
        'docs/plan_nope-youtube-home.md',
        'manifest.json',
        'popup/',
        'src/adapters/youtube.js',
        'src/adapters/youtube_watch.js',
        'src/content-name.js',
        'src/content-search.js',
        'src/storage.js',
        'test/',
      ],
      queryId: 'flow-audit-output',
    }),
  },
};

witnessSet.witness_set_digest = todoSelfDigest(witnessSet, 'witness_set_digest');
writeFileSync(
  '/Users/kite/Developer/nope/.lattice/todo/witness/nope-youtube-home.json',
  `${canonicalizeTodoArtifact(witnessSet)}\n`,
);
console.log('written witnesses=2');
