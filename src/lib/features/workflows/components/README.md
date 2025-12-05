# Workflow Canvas Components

Production-ready workflow builder components using @xyflow/svelte v1.5.0 and Svelte 5.

## Components

### WorkflowCanvas

Main canvas component for building and displaying workflows.

**Props:**
- `workflowId` (string, required) - Unique identifier for the workflow
- `initialNodes` (WorkflowNode[], optional) - Initial nodes to display
- `initialEdges` (WorkflowEdge[], optional) - Initial edges to display
- `readonly` (boolean, optional) - Disable editing if true
- `class` (string, optional) - Additional CSS classes
- `onNodeClick` (function, optional) - Callback when node is clicked
- `onNodeDoubleClick` (function, optional) - Callback when node is double-clicked
- `onCanvasClick` (function, optional) - Callback when canvas is clicked

**Features:**
- Drag and drop nodes
- Connect nodes with edges
- Auto-save (2 second debounce)
- Keyboard shortcuts (Delete/Backspace to remove, Cmd+S to save)
- Background grid
- Minimap
- Controls (zoom, fit view)
- Prevents invalid connections (e.g., can't connect to trigger nodes)

### TriggerNode

Custom node component for workflow triggers.

**Display:**
- Purple/indigo color scheme
- Shows trigger type badge
- Only has output handle (source)
- Visual status indication (idle, running, success, error)

### ActionNode

Custom node component for workflow actions.

**Display:**
- Color-coded by action type (Slack, Discord, Email, HTTP, Condition)
- Shows action type badge
- Has both input and output handles
- Visual status indication (idle, running, success, error)

## Usage Example

```svelte
<script lang="ts">
  import { WorkflowCanvas } from '$lib/features/workflows/components';
  import type { WorkflowNode, WorkflowEdge } from '$lib/features/workflows/types';

  const workflowId = 'workflow_123';

  const initialNodes: WorkflowNode[] = [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: {
        label: 'New Event',
        description: 'Triggered when a new event is created',
        config: {
          triggerType: 'event_type',
          eventTypes: ['user.created']
        }
      }
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 400, y: 100 },
      data: {
        label: 'Send to Slack',
        description: 'Post message to #notifications',
        config: {
          actionType: 'slack',
          webhookUrl: 'https://hooks.slack.com/...',
          messageTemplate: 'New user: {{user.name}}'
        }
      }
    }
  ];

  const initialEdges: WorkflowEdge[] = [
    {
      id: 'edge-1',
      source: 'trigger-1',
      target: 'action-1',
      type: 'default'
    }
  ];

  function handleNodeClick(node) {
    console.log('Node clicked:', node);
  }
</script>

<div class="h-screen w-full">
  <WorkflowCanvas
    {workflowId}
    {initialNodes}
    {initialEdges}
    onNodeClick={handleNodeClick}
  />
</div>
```

## Store Usage

The components use a centralized store for state management:

```typescript
import { workflowStore } from '$lib/features/workflows/stores/workflow-store.svelte';

// Add a new node programmatically
const newNode = workflowStore.addNode(
  'action',
  { x: 300, y: 200 },
  {
    label: 'Email Action',
    config: {
      actionType: 'email',
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Message body'
    }
  }
);

// Update node data
workflowStore.updateNode('node-123', {
  label: 'Updated Label'
});

// Delete node
workflowStore.deleteNode('node-123');

// Force save (bypass auto-save delay)
await workflowStore.forceSave();

// Get current state
const nodes = workflowStore.nodes;
const edges = workflowStore.edges;
const isDirty = workflowStore.isDirty;
```

## Keyboard Shortcuts

- **Delete/Backspace**: Remove selected nodes and edges
- **Cmd+S** (Mac) / **Ctrl+S** (Windows/Linux): Force save workflow

## Auto-Save

Changes are automatically saved after 2 seconds of inactivity. A "Saving changes..." indicator appears in the bottom-right corner during save operations.

## API Integration

The store expects a PATCH endpoint at `/api/workflows/:workflowId` that accepts:

```json
{
  "nodes": [/* WorkflowNode[] */],
  "edges": [/* WorkflowEdge[] */]
}
```

## Styling

The components use Tailwind CSS classes and are fully themeable. The canvas has a light gray background by default.

## Next Steps

To add more features:

1. **Add Node Toolbar**: Create buttons to add nodes dynamically
2. **Node Configuration Panel**: Edit node properties in a sidebar
3. **Validation**: Add workflow validation (e.g., must have one trigger)
4. **Undo/Redo**: Implement command pattern for history
5. **Node Search**: Filter and search nodes
6. **Export/Import**: Save/load workflow definitions
