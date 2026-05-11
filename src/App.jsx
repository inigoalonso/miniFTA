import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Circle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Save,
  GitBranch,
  ShieldAlert,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";

const initialTree = {
  id: "top",
  type: "TOP",
  gate: "OR",
  title: "Loss of beam permit",
  description: "Top event for the fault tree analysis.",
  probability: "",
  expanded: true,
  children: [
    {
      id: "n1",
      type: "GATE",
      gate: "AND",
      title: "Erroneous machine state accepted",
      description: "Control system accepts an unsafe combination of conditions.",
      probability: "",
      expanded: true,
      children: [
        {
          id: "n1-1",
          type: "BASIC",
          gate: null,
          title: "Sensor reports stale value",
          description: "Input value is not refreshed within required time window.",
          probability: "2e-4",
          expanded: true,
          children: [],
        },
        {
          id: "n1-2",
          type: "BASIC",
          gate: null,
          title: "Interlock logic mismatch",
          description: "Requirement interpretation differs between design and implementation.",
          probability: "8e-5",
          expanded: true,
          children: [],
        },
      ],
    },
    {
      id: "n2",
      type: "GATE",
      gate: "OR",
      title: "Actuator does not respond",
      description: "Command is issued but the physical mitigation chain fails.",
      probability: "",
      expanded: true,
      children: [
        {
          id: "n2-1",
          type: "BASIC",
          gate: null,
          title: "Power supply unavailable",
          description: "Local power supply unavailable at demand time.",
          probability: "1e-4",
          expanded: true,
          children: [],
        },
      ],
    },
  ],
};

const typeOptions = ["TOP", "GATE", "BASIC", "UNDEVELOPED"];
const gateOptions = ["OR", "AND", "VOTE", "INHIBIT"];

function uid() {
  return `n-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneTree(node) {
  return { ...node, children: node.children.map(cloneTree) };
}

function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function updateNode(node, id, patch) {
  if (node.id === id) return { ...node, ...patch };
  return { ...node, children: node.children.map((child) => updateNode(child, id, patch)) };
}

function addChild(node, parentId, child) {
  if (node.id === parentId) {
    return { ...node, expanded: true, children: [...node.children, child] };
  }
  return { ...node, children: node.children.map((c) => addChild(c, parentId, child)) };
}

function deleteNode(node, id) {
  return { ...node, children: node.children.filter((c) => c.id !== id).map((c) => deleteNode(c, id)) };
}

function flattenCount(node) {
  return 1 + node.children.reduce((sum, child) => sum + flattenCount(child), 0);
}

function GateBadge({ node }) {
  const common = "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm";
  if (node.type === "TOP") {
    return <div className={`${common} bg-red-100 text-red-700`}><ShieldAlert className="h-4 w-4" /></div>;
  }
  if (node.type === "GATE") {
    return <div className={`${common} bg-indigo-100 text-indigo-700`}>{node.gate}</div>;
  }
  if (node.type === "UNDEVELOPED") {
    return <div className={`${common} bg-amber-100 text-amber-700`}><AlertTriangle className="h-4 w-4" /></div>;
  }
  return <div className={`${common} bg-slate-100 text-slate-700`}><Circle className="h-4 w-4" /></div>;
}

function TreeNode({ node, depth, selectedId, onSelect, onToggle }) {
  const hasChildren = node.children.length > 0;
  const selected = selectedId === node.id;

  return (
    <div className="relative">
      <motion.div
        layout
        className={`mb-2 rounded-2xl border bg-white shadow-sm ${selected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}
        style={{ marginLeft: depth * 18 }}
      >
        <button className="flex w-full items-center gap-2 p-3 text-left" onClick={() => onSelect(node.id)}>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggle(node.id);
            }}
            aria-label="Toggle node"
          >
            {hasChildren ? node.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : <GitBranch className="h-4 w-4 opacity-30" />}
          </button>
          <GateBadge node={node} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">{node.title || "Untitled node"}</p>
            </div>
            <p className="truncate text-xs text-slate-500">
              {node.type}{node.gate ? ` · ${node.gate} gate` : ""}{node.probability ? ` · P=${node.probability}` : ""}
            </p>
          </div>
        </button>
      </motion.div>
      <AnimatePresence initial={false}>
        {node.expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BottomDrawer({ selected, rootId, onClose, onSave, onAddChild, onDelete }) {
  const [draft, setDraft] = useState(selected);

  React.useEffect(() => setDraft(selected), [selected]);
  if (!selected || !draft) return null;

  const canHaveGate = draft.type === "TOP" || draft.type === "GATE";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 bg-slate-950/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Edit FTA node</p>
            <h2 className="text-lg font-bold text-slate-950">{selected.title || "Untitled node"}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Title
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Node type
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value;
                  setDraft({ ...draft, type, gate: type === "GATE" || type === "TOP" ? draft.gate || "OR" : null });
                }}
              >
                {typeOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Gate
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-base outline-none disabled:bg-slate-50 disabled:text-slate-400"
                value={draft.gate || ""}
                disabled={!canHaveGate}
                onChange={(e) => setDraft({ ...draft, gate: e.target.value })}
              >
                {gateOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Probability / frequency
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
              placeholder="e.g. 1e-5 per demand"
              value={draft.probability || ""}
              onChange={(e) => setDraft({ ...draft, probability: e.target.value })}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Description
            <textarea
              className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="rounded-2xl" onClick={() => onAddChild(selected.id)}>
            <Plus className="mr-2 h-4 w-4" /> Add child
          </Button>
          <Button className="rounded-2xl" variant="outline" onClick={() => onSave(draft)}>
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
        </div>

        <Button
          className="mt-3 w-full rounded-2xl"
          variant="destructive"
          disabled={selected.id === rootId}
          onClick={() => onDelete(selected.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete node
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

export default function FTAMobilePrototype() {
  const [tree, setTree] = useState(initialTree);
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectedId ? findNode(tree, selectedId) : null;
  const nodeCount = useMemo(() => flattenCount(tree), [tree]);

  const toggleNode = (id) => {
    const node = findNode(tree, id);
    setTree(updateNode(tree, id, { expanded: !node.expanded }));
  };

  const saveNode = (draft) => {
    setTree(updateNode(tree, draft.id, {
      title: draft.title,
      type: draft.type,
      gate: draft.type === "TOP" || draft.type === "GATE" ? draft.gate || "OR" : null,
      description: draft.description,
      probability: draft.probability,
    }));
  };

  const addNewChild = (parentId) => {
    const child = {
      id: uid(),
      type: "BASIC",
      gate: null,
      title: "New basic event",
      description: "Describe the failure mode or causal event.",
      probability: "",
      expanded: true,
      children: [],
    };
    setTree(addChild(tree, parentId, child));
    setSelectedId(child.id);
  };

  const removeNode = (id) => {
    setTree(deleteNode(tree, id));
    setSelectedId(null);
  };

  const exportJson = () => {
    const payload = JSON.stringify(tree, null, 2);
    navigator.clipboard?.writeText(payload);
    alert("FTA JSON copied to clipboard.");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Fault Tree Analysis</p>
              <h1 className="text-xl font-black tracking-tight">Mobile FTA Editor</h1>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
              <p className="text-xs text-slate-500">Nodes</p>
              <p className="text-lg font-bold">{nodeCount}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-28">
          <Card className="mb-4 rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><GitBranch className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-bold">Nested-list notation</h2>
                  <p className="text-sm text-slate-600">Tap any node to edit details. Gates become compact badges rather than diagram symbols, which is more usable on a phone.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <TreeNode node={tree} depth={0} selectedId={selectedId} onSelect={setSelectedId} onToggle={toggleNode} />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            <Button className="rounded-2xl" variant="outline" onClick={() => setTree(cloneTree(initialTree))}>
              <Upload className="mr-2 h-4 w-4" /> Demo
            </Button>
            <Button className="rounded-2xl" variant="outline" onClick={exportJson}>
              <Download className="mr-2 h-4 w-4" /> JSON
            </Button>
            <Button className="rounded-2xl" onClick={() => setSelectedId(tree.id)}>
              Edit top
            </Button>
          </div>
        </nav>
      </div>

      {selected && (
        <BottomDrawer
          selected={selected}
          rootId={tree.id}
          onClose={() => setSelectedId(null)}
          onSave={saveNode}
          onAddChild={addNewChild}
          onDelete={removeNode}
        />
      )}
    </div>
  );
}
