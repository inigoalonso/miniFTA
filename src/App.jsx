import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
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

const initialTree = {
  id: "top",
  type: "TOP_EVENT",
  title: "Loss of beam permit",
  description: "Top event for the fault tree analysis.",
  probability: "",
  expanded: true,
  children: [
    {
      id: "n1",
      type: "GATE",
      gateType: "AND",
      title: "Erroneous machine state accepted",
      description: "Control system accepts an unsafe combination of conditions.",
      probability: "",
      expanded: true,
      children: [
        {
          id: "n1-1",
          type: "BASIC_EVENT",
          title: "Sensor reports stale value",
          description: "Input value is not refreshed within required time window.",
          probability: "2e-4",
          expanded: true,
          children: [],
        },
        {
          id: "n1-2",
          type: "UNDEVELOPED_EVENT",
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
      gateType: "OR",
      title: "Actuator does not respond",
      description: "Command is issued but the physical mitigation chain fails.",
      probability: "",
      expanded: true,
      children: [
        {
          id: "n2-1",
          type: "TRANSFER_EVENT",
          title: "External power transfer failure",
          description: "Fault chain enters a separate analysis boundary.",
          probability: "1e-4",
          expanded: true,
          children: [],
        },
      ],
    },
  ],
};

const nodeTypeOptions = [
  { value: "TOP_EVENT", label: "Top event" },
  { value: "GATE", label: "Gate" },
  { value: "INTERMEDIATE_EVENT", label: "Intermediate event" },
  { value: "BASIC_EVENT", label: "Basic event" },
  { value: "UNDEVELOPED_EVENT", label: "Undeveloped event" },
  { value: "TRANSFER_EVENT", label: "Transfer event" },
];
const gateTypeOptions = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
  { value: "INHIBIT", label: "Inhibit" },
  { value: "K_OUT_OF_N", label: "K/N" },
  { value: "XOR", label: "Exclusive OR" },
];

const FTA_STANDARD_LABEL = "EIA 61025:2017";

const typeLabels = {
  TOP_EVENT: "Top event",
  GATE: "Gate",
  INTERMEDIATE_EVENT: "Intermediate event",
  BASIC_EVENT: "Basic event",
  UNDEVELOPED_EVENT: "Undeveloped event",
  TRANSFER_EVENT: "Transfer event",
};
const gateTypeLabels = {
  AND: "AND",
  OR: "OR",
  INHIBIT: "Inhibit",
  K_OUT_OF_N: "K/N",
  XOR: "Exclusive OR",
};

const IEC_61025_RULES = {
  canHaveChildren: {
    TOP_EVENT: true,
    GATE: true,
    INTERMEDIATE_EVENT: true,
    BASIC_EVENT: false,
    UNDEVELOPED_EVENT: false,
    TRANSFER_EVENT: false,
  },
  allowedChildTypes: {
    TOP_EVENT: ["GATE"],
    GATE: ["GATE", "INTERMEDIATE_EVENT", "BASIC_EVENT", "UNDEVELOPED_EVENT", "TRANSFER_EVENT"],
    INTERMEDIATE_EVENT: ["GATE"],
  },
};

function canHaveChildren(nodeType) {
  return IEC_61025_RULES.canHaveChildren[nodeType] || false;
}

function getAllowedChildTypes(parentType) {
  return IEC_61025_RULES.allowedChildTypes[parentType] || [];
}

function formatRuleMessage(message) {
  return `${message} (${FTA_STANDARD_LABEL})`;
}

function validateAddChild(parentNode, childType) {
  if (!canHaveChildren(parentNode.type)) {
    return { valid: false, error: formatRuleMessage(`${typeLabels[parentNode.type]} nodes cannot have children`) };
  }
  const allowed = getAllowedChildTypes(parentNode.type);
  if (!allowed.includes(childType)) {
    return { valid: false, error: formatRuleMessage(`${typeLabels[childType]} cannot be a child of ${typeLabels[parentNode.type]}`) };
  }
  return { valid: true };
}

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

function findParentNode(node, id, parent = null) {
  if (node.id === id) return parent;
  for (const child of node.children) {
    const found = findParentNode(child, id, node);
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

function getNodePatch(draft) {
  const patch = {
    title: draft.title,
    type: draft.type,
    description: draft.description,
    probability: draft.probability,
  };
  if (draft.type === "GATE") {
    patch.gateType = draft.gateType || "AND";
  } else {
    patch.gateType = undefined;
  }
  return patch;
}

function validateNodeTypeChange(node, nextType, parentNode, isRoot) {
  if (isRoot && nextType !== "TOP_EVENT") {
    return { valid: false, error: formatRuleMessage("The root node must remain the top event") };
  }

  if (parentNode && !getAllowedChildTypes(parentNode.type).includes(nextType)) {
    return {
      valid: false,
      error: formatRuleMessage(`${typeLabels[nextType]} cannot be a child of ${typeLabels[parentNode.type]}`),
    };
  }

  if (!canHaveChildren(nextType) && node.children.length > 0) {
    return {
      valid: false,
      error: formatRuleMessage(
        `Cannot change to ${typeLabels[nextType]} because this node has ${node.children.length} child${node.children.length === 1 ? "" : "ren"}`,
      ),
    };
  }

  const allowedChildren = getAllowedChildTypes(nextType);
  const invalidChild = node.children.find((child) => !allowedChildren.includes(child.type));
  if (invalidChild) {
    return {
      valid: false,
      error: formatRuleMessage(
        `Cannot change to ${typeLabels[nextType]} because it already has a ${typeLabels[invalidChild.type]} child`,
      ),
    };
  }

  return { valid: true };
}

function collectRuleViolations(node, parentNode = null, isRoot = true, violations = []) {
  if (isRoot && node.type !== "TOP_EVENT") {
    violations.push(formatRuleMessage("The root node must remain the top event"));
  }

  if (parentNode && !getAllowedChildTypes(parentNode.type).includes(node.type)) {
    violations.push(formatRuleMessage(`${typeLabels[node.type]} cannot be a child of ${typeLabels[parentNode.type]}`));
  }

  if (!canHaveChildren(node.type) && node.children.length > 0) {
    violations.push(formatRuleMessage(`${typeLabels[node.type]} nodes cannot have children`));
  }

  node.children.forEach((child) => collectRuleViolations(child, node, false, violations));
  return violations;
}

function getFirstRuleViolation(tree) {
  return collectRuleViolations(tree)[0] || "";
}

const DB_NAME = "minifta";
const STORE_NAME = "fta-trees";
const DB_VERSION = 1;
const TREE_KEY = "current-tree";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getTreeFromDb() {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(TREE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  });
}

function saveTreeToDb(tree) {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(tree, TREE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

function isValidNode(node) {
  if (
    !node ||
    typeof node !== "object" ||
    typeof node.id !== "string" ||
    typeof node.type !== "string" ||
    typeof node.title !== "string" ||
    typeof node.description !== "string" ||
    typeof node.probability !== "string" ||
    typeof node.expanded !== "boolean" ||
    !Array.isArray(node.children) ||
    !node.children.every(isValidNode)
  ) {
    return false;
  }

  if (!nodeTypeOptions.some((option) => option.value === node.type)) {
    return false;
  }

  if (node.type === "GATE") {
    return typeof node.gateType === "string" && gateTypeOptions.some((option) => option.value === node.gateType);
  }

  return !Object.prototype.hasOwnProperty.call(node, "gateType") || node.gateType === undefined;
}

function isValidTree(tree) {
  return isValidNode(tree);
}

function normalizeTree(node) {
  const normalized = {
    ...node,
    expanded: node.expanded !== undefined ? node.expanded : true,
    children: Array.isArray(node.children) ? node.children.map(normalizeTree) : [],
  };

  if (normalized.type === "GATE") {
    normalized.gateType = normalized.gateType || normalized.gate || "AND";
  } else {
    delete normalized.gateType;
  }
  delete normalized.gate;

  return normalized;
}

function GateBadge({ node }) {
  const common = "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm";
  if (node.type === "TOP_EVENT") {
    return <div className={`${common} bg-red-100 text-red-700`}><ShieldAlert className="h-4 w-4" /></div>;
  }
  if (node.type === "GATE") {
    return <div className={`${common} bg-indigo-100 text-indigo-700`}>{node.gateType}</div>;
  }
  if (node.type === "INTERMEDIATE_EVENT") {
    return <div className={`${common} bg-teal-100 text-teal-700`}>IE</div>;
  }
  if (node.type === "UNDEVELOPED_EVENT") {
    return <div className={`${common} bg-amber-100 text-amber-700`}><AlertTriangle className="h-4 w-4" /></div>;
  }
  if (node.type === "TRANSFER_EVENT") {
    return <div className={`${common} bg-sky-100 text-sky-700`}><ArrowRight className="h-4 w-4" /></div>;
  }
  return <div className={`${common} bg-slate-100 text-slate-700`}><Circle className="h-4 w-4" /></div>;
}

function RuleFeedback({ feedback, onDismiss }) {
  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          key={feedback.id}
          role="alert"
          aria-live="assertive"
          className="fixed left-4 right-4 top-20 z-[70] mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-950 shadow-2xl"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">FTA rule blocked</p>
            <p className="text-sm leading-snug text-red-800">{feedback.message}</p>
          </div>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-red-700 transition hover:bg-red-100"
            onClick={onDismiss}
            aria-label="Dismiss rule feedback"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
              {typeLabels[node.type] || node.type}{node.type === "GATE" ? ` · ${gateTypeLabels[node.gateType] || node.gateType} gate` : ""}{node.probability ? ` · P=${node.probability}` : ""}
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

function BottomDrawer({ selected, rootId, parentNode, onClose, onSave, onAddChild, onDelete, onRuleViolation }) {
  const [draft, setDraft] = useState(selected);
  const [validationError, setValidationError] = useState("");

  if (!selected || !draft) return null;

  const canHaveGate = draft.type === "GATE";
  const canAddChildren = canHaveChildren(draft.type);

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
                  const nextDraft = { ...draft, type };
                  const ruleCheck = validateNodeTypeChange(draft, type, parentNode, selected.id === rootId);
                  
                  if (!ruleCheck.valid) {
                    setValidationError(ruleCheck.error);
                    onRuleViolation(ruleCheck.error);
                    return;
                  }
                  
                  setValidationError("");
                  if (type === "GATE") {
                    nextDraft.gateType = draft.gateType || "AND";
                  } else {
                    delete nextDraft.gateType;
                  }
                  setDraft(nextDraft);
                }}
              >
                {nodeTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Gate type
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-base outline-none disabled:bg-slate-50 disabled:text-slate-400"
                value={draft.gateType || ""}
                disabled={!canHaveGate}
                onChange={(e) => setDraft({ ...draft, gateType: e.target.value })}
              >
                {gateTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
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
          <Button 
            className="rounded-2xl" 
            variant={canAddChildren ? "default" : "outline"}
            onClick={() => {
              const result = onAddChild(selected.id, draft);
              if (result && !result.valid) {
                setValidationError(result.error);
                return;
              }
              setValidationError("");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add child
          </Button>
          <Button
            className="rounded-2xl"
            variant="outline"
            onClick={() => {
              const result = onSave(draft);
              if (result && !result.valid) {
                setValidationError(result.error);
                return;
              }
              setValidationError("");
            }}
          >
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
        </div>

        {!canAddChildren && (
          <p className="mt-3 text-xs text-amber-600">
            {typeLabels[draft.type]} nodes cannot have children per {FTA_STANDARD_LABEL}.
          </p>
        )}

        {validationError && (
          <p className="mt-3 text-xs text-red-600">{validationError}</p>
        )}

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
  const [storageStatus, setStorageStatus] = useState("loading");
  const [importError, setImportError] = useState("");
  const [ruleFeedback, setRuleFeedback] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const fileInputRef = useRef(null);
  const selected = selectedId ? findNode(tree, selectedId) : null;
  const selectedParent = selectedId ? findParentNode(tree, selectedId) : null;
  const nodeCount = useMemo(() => flattenCount(tree), [tree]);

  const showRuleFeedback = (message) => {
    setRuleFeedback({ id: uid(), message });
  };

  useEffect(() => {
    let canceled = false;

    getTreeFromDb()
      .then((stored) => {
        if (canceled) return;
        if (stored && isValidTree(stored)) {
          const normalized = normalizeTree(stored);
          if (!getFirstRuleViolation(normalized)) {
            setTree(normalized);
            setStorageStatus("loaded");
          } else {
            setStorageStatus("initialized");
          }
        } else {
          setStorageStatus("initialized");
        }
      })
      .catch((error) => {
        if (canceled) return;
        console.warn("IndexedDB load failed", error);
        setStorageStatus("unsupported");
      })
      .finally(() => {
        if (!canceled) setDbReady(true);
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!ruleFeedback) return undefined;

    const timeout = window.setTimeout(() => setRuleFeedback(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [ruleFeedback]);

  useEffect(() => {
    if (!dbReady || storageStatus === "unsupported") return;

    saveTreeToDb(tree)
      .then(() => setStorageStatus("saved"))
      .catch((error) => {
        console.warn("IndexedDB save failed", error);
        setStorageStatus("unsupported");
      });
  }, [tree, dbReady, storageStatus]);

  const toggleNode = (id) => {
    const node = findNode(tree, id);
    setTree(updateNode(tree, id, { expanded: !node.expanded }));
  };

  const saveNode = (draft) => {
    const currentNode = findNode(tree, draft.id);
    const parentNode = findParentNode(tree, draft.id);
    const ruleCheck = validateNodeTypeChange(currentNode || draft, draft.type, parentNode, draft.id === tree.id);
    if (!ruleCheck.valid) {
      showRuleFeedback(ruleCheck.error);
      return ruleCheck;
    }

    setTree(updateNode(tree, draft.id, getNodePatch(draft)));
    return { valid: true };
  };

  const addNewChild = (parentId, parentDraft = null) => {
    const savedParentNode = findNode(tree, parentId);
    if (!savedParentNode) return { valid: false, error: "Parent node was not found." };
    const parentNode = parentDraft || savedParentNode;
    const parentOfParent = findParentNode(tree, parentId);
    const parentRuleCheck = validateNodeTypeChange(savedParentNode, parentNode.type, parentOfParent, parentId === tree.id);
    if (!parentRuleCheck.valid) {
      showRuleFeedback(parentRuleCheck.error);
      return parentRuleCheck;
    }

    let childType = "BASIC_EVENT";
    let childTitle = "New basic event";

    if (parentNode.type === "TOP_EVENT" || parentNode.type === "INTERMEDIATE_EVENT") {
      childType = "GATE";
      childTitle = "New gate";
    }

    const ruleCheck = validateAddChild(parentNode, childType);
    if (!ruleCheck.valid) {
      showRuleFeedback(ruleCheck.error);
      return ruleCheck;
    }

    const child = {
      id: uid(),
      type: childType,
      title: childTitle,
      description: childType === "GATE" ? "Combines input events" : "Describe the failure mode or causal event.",
      probability: "",
      expanded: true,
      children: [],
    };

    if (childType === "GATE") {
      child.gateType = "AND";
    }

    const nextTree = parentDraft ? updateNode(tree, parentId, getNodePatch(parentDraft)) : tree;
    setTree(addChild(nextTree, parentId, child));
    setSelectedId(child.id);
    return { valid: true };
  };

  const removeNode = (id) => {
    setTree(deleteNode(tree, id));
    setSelectedId(null);
  };

  const importJson = () => {
    setImportError("");
    fileInputRef.current?.click();
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!isValidTree(parsed)) {
          throw new Error("Invalid FTA structure");
        }
        const normalized = normalizeTree(parsed);
        const ruleViolation = getFirstRuleViolation(normalized);
        if (ruleViolation) {
          throw new Error(ruleViolation);
        }
        setTree(normalized);
        setSelectedId(null);
        setImportError("");
        alert("FTA tree imported successfully.");
      } catch (error) {
        console.warn("Import failed", error);
        const message = error.message?.includes(FTA_STANDARD_LABEL)
          ? error.message
          : "Invalid JSON file. Please select a valid FTA export.";
        setImportError(message);
        if (message.includes(FTA_STANDARD_LABEL)) {
          showRuleFeedback(message);
        }
      }
      event.target.value = "";
    };
    reader.onerror = () => {
      setImportError("Unable to read the JSON file. Please try again.");
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const exportJson = () => {
    const payload = JSON.stringify(tree, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fta-tree.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel =
    storageStatus === "loading"
      ? "Loading tree from browser storage..."
      : storageStatus === "unsupported"
      ? "Browser persistence unavailable. Data is still editable for this session."
      : storageStatus === "loaded"
      ? "Tree loaded from browser storage. Changes auto-save locally."
      : storageStatus === "initialized"
      ? "No saved tree found. Using initial demo data."
      : "Changes are auto-saved in browser storage.";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.16),_transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef2ff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">Fault Tree Analysis</p>
          <p className="text-xs text-slate-500">{statusLabel} · {nodeCount} nodes</p>
          {importError && <p className="text-xs text-red-600">{importError}</p>}
        </header>
        <RuleFeedback feedback={ruleFeedback} onDismiss={() => setRuleFeedback(null)} />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-6">

        <main className="flex-1 space-y-4 px-0 py-4">
          <TreeNode node={tree} depth={0} selectedId={selectedId} onSelect={setSelectedId} onToggle={toggleNode} />
        </main>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
            <Button className="h-12 min-w-0 rounded-xl px-2 text-xs sm:text-sm" variant="ghost" onClick={() => setTree(cloneTree(initialTree))}>
              <Upload className="mr-2 h-4 w-4" /> Demo
            </Button>
            <Button className="h-12 min-w-0 rounded-xl px-2 text-xs sm:text-sm" variant="ghost" onClick={importJson}>
              <Upload className="mr-2 h-4 w-4 rotate-180 transform" /> Import
            </Button>
            <Button className="h-12 min-w-0 rounded-xl px-2 text-xs sm:text-sm" variant="ghost" onClick={exportJson}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button className="h-12 min-w-0 rounded-xl px-2 text-xs sm:text-sm" variant="ghost" onClick={() => setSelectedId(tree.id)}>
              Edit top
            </Button>
          </div>
        </nav>
      </div>
      </div>

      {selected && (
        <BottomDrawer
          key={selected.id}
          selected={selected}
          rootId={tree.id}
          parentNode={selectedParent}
          onClose={() => setSelectedId(null)}
          onSave={saveNode}
          onAddChild={addNewChild}
          onDelete={removeNode}
          onRuleViolation={showRuleFeedback}
        />
      )}
    </div>
  );
}
