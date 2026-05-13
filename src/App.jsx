import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  Plus,
  ListChecks,
  Redo2,
  Search,
  Trash2,
  Undo2,
  X,
  Save,
  Settings,
  GitBranch,
  GripVertical,
  GitFork,
} from "lucide-react";
import { Button } from "./components/ui/button";
import andGateSymbol from "./assets/symbols/and-gate.svg";
import basicEventSymbol from "./assets/symbols/basic-event.svg";
import exclusiveOrGateSymbol from "./assets/symbols/exclusive-or-gate.svg";
import houseEventSymbol from "./assets/symbols/house-event.svg";
import inhibitGateSymbol from "./assets/symbols/inhibit-gate.svg";
import intermediateEventSymbol from "./assets/symbols/intermediate-event.svg";
import orGateSymbol from "./assets/symbols/or-gate.svg";
import transferOutSymbol from "./assets/symbols/transfer-out.svg";
import undevelopedEventSymbol from "./assets/symbols/undeveloped-event.svg";

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
          type: "TRANSFER_OUT",
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
  { value: "INTERMEDIATE_EVENT", label: "Intermediate event" },
  { value: "BASIC_EVENT", label: "Basic event" },
  { value: "UNDEVELOPED_EVENT", label: "Undeveloped event" },
  { value: "DORMANT_EVENT", label: "Dormant event" },
  { value: "HOUSE_EVENT", label: "House event" },
  { value: "CONDITIONAL_EVENT", label: "Conditional event" },
  { value: "TRANSFER_IN", label: "Transfer in" },
  { value: "TRANSFER_OUT", label: "Transfer out" },
  { value: "GATE", label: "Gate" },
];
const gateTypeOptions = [
  { value: "AND", label: "AND", category: "STATIC" },
  { value: "OR", label: "OR", category: "STATIC" },
  { value: "INHIBIT", label: "Inhibit", category: "STATIC" },
  { value: "K_OUT_OF_N", label: "K/N", category: "STATIC" },
  { value: "XOR", label: "Exclusive OR", category: "STATIC" },
  { value: "PRIORITY_AND", label: "Priority AND", category: "DYNAMIC" },
  { value: "SEQUENTIAL", label: "Sequential", category: "DYNAMIC" },
  { value: "SPARE", label: "Spare", category: "DYNAMIC" },
  { value: "NULL", label: "Null", category: "STRUCTURAL" },
];
const defaultGateAvailability = Object.fromEntries(gateTypeOptions.map((option) => [option.value, true]));

const FTA_STANDARD_LABEL = "EIA 61025:2017";
const TREE_HISTORY_LIMIT = 80;

const typeLabels = {
  TOP_EVENT: "Top event",
  GATE: "Gate",
  INTERMEDIATE_EVENT: "Intermediate event",
  BASIC_EVENT: "Basic event",
  UNDEVELOPED_EVENT: "Undeveloped event",
  DORMANT_EVENT: "Dormant event",
  HOUSE_EVENT: "House event",
  CONDITIONAL_EVENT: "Conditional event",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};
const gateTypeLabels = {
  AND: "AND",
  OR: "OR",
  INHIBIT: "Inhibit",
  K_OUT_OF_N: "K/N",
  XOR: "Exclusive OR",
  PRIORITY_AND: "Priority AND",
  SEQUENTIAL: "Sequential",
  SPARE: "Spare",
  NULL: "Null",
};
const gateRuleKeyByGateType = {
  AND: "AND_GATE",
  OR: "OR_GATE",
  INHIBIT: "INHIBIT_GATE",
  K_OUT_OF_N: "MAJORITY_VOTE_GATE",
  XOR: "EXCLUSIVE_OR_GATE",
  PRIORITY_AND: "PRIORITY_AND_GATE",
  SEQUENTIAL: "SEQUENTIAL_GATE",
  SPARE: "SPARE_GATE",
  NULL: "NULL_GATE",
};

const symbolByNodeType = {
  TOP_EVENT: intermediateEventSymbol,
  INTERMEDIATE_EVENT: intermediateEventSymbol,
  BASIC_EVENT: basicEventSymbol,
  UNDEVELOPED_EVENT: undevelopedEventSymbol,
  TRANSFER_OUT: transferOutSymbol,
  TRANSFER_IN: transferOutSymbol,
  DORMANT_EVENT: undevelopedEventSymbol,
  HOUSE_EVENT: houseEventSymbol,
  CONDITIONAL_EVENT: basicEventSymbol,
};

const symbolByGateType = {
  AND: andGateSymbol,
  OR: orGateSymbol,
  INHIBIT: inhibitGateSymbol,
  XOR: exclusiveOrGateSymbol,
};

const DRAG_NODE_MIME_TYPE = "application/x-minifta-node";
const NODE_DROP_TARGET_SELECTOR = "[data-node-drop-id]";

const IEC_61025_RULES = {
  nodeTypes: {
    TOP_EVENT: {
      category: "EVENT",
      description: "Defined outcome of interest; root of the fault tree.",
      isRootOnly: true,
      canHaveChildren: true,
      mayHaveGate: true,
      maxOutgoingGates: 1,
    },
    INTERMEDIATE_EVENT: {
      category: "EVENT",
      description: "Event that is neither the top event nor a primary event.",
      canHaveChildren: true,
      mayHaveGate: true,
      maxOutgoingGates: 1,
    },
    BASIC_EVENT: {
      category: "PRIMARY_EVENT",
      description: "Lowest-level event for which probability/reliability data are available.",
      canHaveChildren: false,
      mayHaveGate: false,
    },
    UNDEVELOPED_EVENT: {
      category: "PRIMARY_EVENT",
      description: "Primary event intentionally not developed further.",
      canHaveChildren: false,
      mayHaveGate: false,
    },
    DORMANT_EVENT: {
      category: "PRIMARY_EVENT",
      description: "Primary event representing a dormant failure not immediately detected.",
      canHaveChildren: false,
      mayHaveGate: false,
    },
    HOUSE_EVENT: {
      category: "PRIMARY_EVENT",
      description: "User-controlled TRUE/FALSE event used to include/exclude parts of an analysis.",
      canHaveChildren: false,
      mayHaveGate: false,
      requiresBooleanState: true,
    },
    CONDITIONAL_EVENT: {
      category: "CONDITION",
      description: "Condition required for another event to occur; used with INHIBIT and dynamic gates.",
      canHaveChildren: false,
      mayHaveGate: false,
      allowedParents: ["INHIBIT_GATE", "PRIORITY_AND_GATE"],
    },
    TRANSFER_IN: {
      category: "TRANSFER",
      description: "Reference to a fault-tree continuation developed elsewhere.",
      canHaveChildren: false,
      mayHaveGate: false,
      requiresTargetReference: true,
    },
    TRANSFER_OUT: {
      category: "TRANSFER",
      description: "Connector indicating where a transferred subtree is developed.",
      canHaveChildren: true,
      mayHaveGate: true,
      maxOutgoingGates: 1,
      requiresTransferId: true,
    },
    GATE: {
      category: "GATE",
      description: "Logical operator connecting input events to an output event.",
      canHaveChildren: true,
      mustHaveGateType: true,
    },
  },

  canHaveChildren: {
    TOP_EVENT: true,
    INTERMEDIATE_EVENT: true,
    TRANSFER_OUT: true,
    GATE: true,
    BASIC_EVENT: false,
    UNDEVELOPED_EVENT: false,
    DORMANT_EVENT: false,
    HOUSE_EVENT: false,
    CONDITIONAL_EVENT: false,
    TRANSFER_IN: false,
  },

  allowedChildTypes: {
    TOP_EVENT: ["GATE"],
    INTERMEDIATE_EVENT: ["GATE"],
    TRANSFER_OUT: ["GATE"],
    GATE: [
      "INTERMEDIATE_EVENT",
      "BASIC_EVENT",
      "UNDEVELOPED_EVENT",
      "DORMANT_EVENT",
      "HOUSE_EVENT",
      "CONDITIONAL_EVENT",
      "TRANSFER_IN",
    ],
    BASIC_EVENT: [],
    UNDEVELOPED_EVENT: [],
    DORMANT_EVENT: [],
    HOUSE_EVENT: [],
    CONDITIONAL_EVENT: [],
    TRANSFER_IN: [],
  },

  gateTypes: {
    AND_GATE: {
      category: "STATIC",
      description: "Output occurs if all input events occur.",
      minInputs: 2,
      maxInputs: null,
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "AND",
      requiresIndependentInputsForSimpleQuantification: true,
    },
    OR_GATE: {
      category: "STATIC",
      description: "Output occurs if one or more input events occur.",
      minInputs: 2,
      maxInputs: null,
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "OR",
    },
    EXCLUSIVE_OR_GATE: {
      category: "STATIC",
      description: "Output occurs if one, but not the other, input event occurs.",
      minInputs: 2,
      maxInputs: 2,
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "XOR",
    },
    INHIBIT_GATE: {
      category: "STATIC",
      description: "Output occurs when the input event occurs under a stated condition.",
      minInputs: 2,
      maxInputs: 2,
      requiredInputPattern: {
        eventInputs: 1,
        conditionalInputs: 1,
      },
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
        "CONDITIONAL_EVENT",
      ],
      calculation: "AND_WITH_CONDITION",
    },
    MAJORITY_VOTE_GATE: {
      category: "STATIC",
      description: "Output occurs if at least m out of n input events occur.",
      minInputs: 2,
      maxInputs: null,
      requiresVoteThreshold: true,
      voteThresholdRules: {
        min: 1,
        max: "numberOfInputs",
      },
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "K_OUT_OF_N",
    },
    PRIORITY_AND_GATE: {
      category: "DYNAMIC",
      description: "Output occurs only if input events occur in a specified order.",
      minInputs: 2,
      maxInputs: null,
      requiresInputOrdering: true,
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
        "CONDITIONAL_EVENT",
      ],
      calculation: "SEQUENCE_DEPENDENT",
      requiresDynamicAnalysis: true,
    },
    SEQUENTIAL_GATE: {
      category: "DYNAMIC",
      description: "Output occurs only if all input events occur in left-to-right sequence.",
      minInputs: 2,
      maxInputs: null,
      requiresInputOrdering: true,
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "SEQUENCE_DEPENDENT",
      requiresDynamicAnalysis: true,
    },
    SPARE_GATE: {
      category: "DYNAMIC",
      description: "Output occurs when available spare components fall below the required number.",
      minInputs: 1,
      maxInputs: null,
      requiresSpareModel: true,
      spareModels: ["COLD_SPARE", "WARM_SPARE", "HOT_SPARE"],
      allowedInputTypes: [
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "INTERMEDIATE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "SPARE_DEPENDENCY",
      requiresDynamicAnalysis: true,
    },
    NULL_GATE: {
      category: "STRUCTURAL",
      description: "Pass-through gate with one input, used by some rectangular notations.",
      minInputs: 1,
      maxInputs: 1,
      allowedInputTypes: [
        "INTERMEDIATE_EVENT",
        "BASIC_EVENT",
        "UNDEVELOPED_EVENT",
        "DORMANT_EVENT",
        "HOUSE_EVENT",
        "TRANSFER_IN",
      ],
      calculation: "IDENTITY",
      discourageForNewModels: true,
    },
  },

  parentRules: {
    TOP_EVENT: {
      allowedParentTypes: [],
      mustBeUnique: true,
    },
    GATE: {
      allowedParentTypes: ["TOP_EVENT", "INTERMEDIATE_EVENT", "TRANSFER_OUT"],
      parentRequired: true,
      maxParents: 1,
    },
    INTERMEDIATE_EVENT: {
      allowedParentTypes: ["GATE"],
      parentRequired: true,
      mayBeRepeated: true,
    },
    BASIC_EVENT: {
      allowedParentTypes: ["GATE"],
      parentRequired: true,
      mayBeRepeated: true,
    },
    UNDEVELOPED_EVENT: {
      allowedParentTypes: ["GATE"],
      parentRequired: true,
      mayBeRepeated: true,
    },
    DORMANT_EVENT: {
      allowedParentTypes: ["GATE"],
      parentRequired: true,
      mayBeRepeated: true,
    },
    HOUSE_EVENT: {
      allowedParentTypes: ["GATE"],
      parentRequired: false,
      mayBeRepeated: true,
    },
    CONDITIONAL_EVENT: {
      allowedParentGateTypes: ["INHIBIT_GATE", "PRIORITY_AND_GATE"],
      parentRequired: true,
    },
    TRANSFER_IN: {
      allowedParentTypes: ["GATE"],
      parentRequired: true,
      requiresMatchingTransferOut: true,
    },
    TRANSFER_OUT: {
      allowedParentTypes: [],
      requiresMatchingTransferIn: true,
    },
  },

  validation: {
    requireSingleTopEvent: true,
    requireTopEventHasGate: true,
    maxOneGatePerDevelopedEvent: true,
    terminalNodeTypes: [
      "BASIC_EVENT",
      "UNDEVELOPED_EVENT",
      "DORMANT_EVENT",
      "HOUSE_EVENT",
      "CONDITIONAL_EVENT",
      "TRANSFER_IN",
    ],
    repeatedEventRules: {
      allowed: true,
      requireSameEventCode: true,
      requireCommonCauseFlagWhenSameCause: true,
      countOnceInQuantitativeAnalysis: true,
      requireDisjointingOrBDDForExactQuantification: true,
    },
    transferRules: {
      transferInMustReferenceTransferOut: true,
      transferOutMustExposeSubtree: true,
      preventCircularTransfers: true,
      referencedEventCodeMustMatch: true,
    },
    eventStateCompatibility: {
      OR_GATE: {
        allowMixedEventAndStateInputs: true,
      },
      AND_GATE: {
        ifOutputIsEventThenInputsMustBeEvents: true,
        ifOutputIsStateThenInputsMustBeStates: true,
      },
    },
    dynamicGateRules: {
      requireInputOrderFor: ["PRIORITY_AND_GATE", "SEQUENTIAL_GATE"],
      requireDynamicAnalysisFor: ["PRIORITY_AND_GATE", "SEQUENTIAL_GATE", "SPARE_GATE"],
      doNotUseStaticCutSetsWithoutApproximation: true,
    },
    probabilityRules: {
      BASIC_EVENT: {
        mayHaveProbability: true,
        mayHaveFailureRate: true,
        mayHaveFrequency: true,
      },
      UNDEVELOPED_EVENT: {
        mayHaveProbability: true,
        mayHaveQualitativeLikelihood: true,
      },
      HOUSE_EVENT: {
        mustHaveBooleanState: true,
      },
      CONDITIONAL_EVENT: {
        mayHaveConditionExpression: true,
        mayHaveProbability: true,
      },
    },
    labellingRules: {
      requireUniqueNodeId: true,
      requireEventCodeForEvents: true,
      requireDescriptionForEvents: true,
      preferDescriptionThenCodeThenProbability: true,
      repeatedEventsShareEventCode: true,
    },
    acyclicity: {
      enabled: true,
      ignoreVisualTransferReferences: false,
    },
  },

  palettes: {
    events: [
      "TOP_EVENT",
      "INTERMEDIATE_EVENT",
      "BASIC_EVENT",
      "UNDEVELOPED_EVENT",
      "DORMANT_EVENT",
      "HOUSE_EVENT",
      "CONDITIONAL_EVENT",
    ],
    gates: [
      "OR_GATE",
      "AND_GATE",
      "EXCLUSIVE_OR_GATE",
      "INHIBIT_GATE",
      "MAJORITY_VOTE_GATE",
      "PRIORITY_AND_GATE",
      "SEQUENTIAL_GATE",
      "SPARE_GATE",
      "NULL_GATE",
    ],
    staticGates: [
      "OR_GATE",
      "AND_GATE",
      "EXCLUSIVE_OR_GATE",
      "INHIBIT_GATE",
      "MAJORITY_VOTE_GATE",
      "NULL_GATE",
    ],
    dynamicGates: [
      "PRIORITY_AND_GATE",
      "SEQUENTIAL_GATE",
      "SPARE_GATE",
    ],
    primaryEvents: [
      "BASIC_EVENT",
      "UNDEVELOPED_EVENT",
      "DORMANT_EVENT",
      "HOUSE_EVENT",
    ],
    transferSymbols: [
      "TRANSFER_IN",
      "TRANSFER_OUT",
    ],
  },
};

function getNodeTypeConfig(type) {
  return IEC_61025_RULES.nodeTypes[type] || null;
}

function getGateTypeConfig(gateType) {
  return IEC_61025_RULES.gateTypes[gateRuleKeyByGateType[gateType]] || null;
}

function canHaveChildren(nodeType) {
  return getNodeTypeConfig(nodeType)?.canHaveChildren || false;
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
  if (allowed.includes(childType)) {
    return { valid: true };
  }

  return { valid: false, error: formatRuleMessage(`${typeLabels[childType]} cannot be a child of ${typeLabels[parentNode.type]}`) };
}

function hasGateChild(node) {
  return node.children.some((child) => child.type === "GATE");
}

function getMissingChildActions(node) {
  if (["TOP_EVENT", "INTERMEDIATE_EVENT", "TRANSFER_OUT"].includes(node.type) && !hasGateChild(node)) {
    return [{ label: "Add gate", type: "GATE", description: "This event needs a gate to connect its input events." }];
  }

  if (node.type === "GATE" && node.children.length === 0) {
    return [
      { label: "Add basic event", type: "BASIC_EVENT", description: "Add a terminal input event to this gate." },
      { label: "Add intermediate event", type: "INTERMEDIATE_EVENT", description: "Add a developed event as a gate input." },
      { label: "Add undeveloped event", type: "UNDEVELOPED_EVENT", description: "Add a placeholder event without inputs." },
    ];
  }

  return [];
}

function uid() {
  return `n-${Math.random().toString(36).slice(2, 9)}`;
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

function moveNode(tree, movedId, targetParentId) {
  const movedNode = findNode(tree, movedId);
  if (!movedNode) return tree;

  return addChild(deleteNode(tree, movedId), targetParentId, movedNode);
}

function areTreesEqual(firstTree, secondTree) {
  return JSON.stringify(firstTree) === JSON.stringify(secondTree);
}

function setTreeExpanded(node, expanded) {
  return {
    ...node,
    expanded,
    children: node.children.map((child) => setTreeExpanded(child, expanded)),
  };
}

function findNodePath(node, id, path = []) {
  const nextPath = [...path, node.id];
  if (node.id === id) return nextPath;

  for (const child of node.children) {
    const childPath = findNodePath(child, id, nextPath);
    if (childPath) return childPath;
  }

  return null;
}

function expandNodePath(node, targetId) {
  const path = findNodePath(node, targetId);
  if (!path) return node;

  const expandedIds = new Set(path);
  return {
    ...node,
    expanded: expandedIds.has(node.id) ? true : node.expanded,
    children: node.children.map((child) => expandNodePath(child, targetId)),
  };
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

function validateMoveNode(tree, movedId, targetParentId) {
  const movedNode = findNode(tree, movedId);
  const targetParentNode = findNode(tree, targetParentId);

  if (!movedNode || !targetParentNode) {
    return { valid: false, error: "The dragged node or drop target was not found." };
  }

  if (movedId === tree.id) {
    return { valid: false, error: formatRuleMessage("The top event cannot be moved") };
  }

  if (movedId === targetParentId) {
    return { valid: false, error: formatRuleMessage("A node cannot be moved into itself") };
  }

  if (findNode(movedNode, targetParentId)) {
    return { valid: false, error: formatRuleMessage("A node cannot be moved into its own child branch") };
  }

  return validateAddChild(targetParentNode, movedNode.type);
}

function getNodeDropTargetIdAtPoint(clientX, clientY) {
  if (typeof document === "undefined") return null;

  const target = document.elementFromPoint(clientX, clientY);
  return target?.closest?.(NODE_DROP_TARGET_SELECTOR)?.dataset.nodeDropId || null;
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

function getNodeDisplayName(node) {
  return node.title?.trim() || typeLabels[node.type] || "Untitled node";
}

function collectStructureCompletionIssues(node, issues = []) {
  const nodeName = getNodeDisplayName(node);

  if (["TOP_EVENT", "INTERMEDIATE_EVENT", "TRANSFER_OUT"].includes(node.type) && !hasGateChild(node)) {
    issues.push(`${nodeName} needs a gate to connect input events.`);
  }

  if (node.type === "GATE" && node.children.length === 0) {
    issues.push(`${nodeName} needs at least one input event.`);
  }

  node.children.forEach((child) => collectStructureCompletionIssues(child, issues));
  return issues;
}

function parseProbability(value) {
  if (!value.trim()) return null;

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
  return parsed;
}

function formatProbability(value) {
  if (value === null || value === undefined) return "Not available";
  if (value === 0) return "0";
  if (value < 0.001) return value.toExponential(3);
  return value.toPrecision(4);
}

function combineProbability(gateType, inputs) {
  if (!inputs.length) return null;

  if (gateType === "AND" || gateType === "INHIBIT") {
    return inputs.reduce((product, value) => product * value, 1);
  }

  if (gateType === "OR") {
    return 1 - inputs.reduce((product, value) => product * (1 - value), 1);
  }

  if (gateType === "XOR") {
    return inputs.reduce((sum, value, index) => {
      const othersDoNotOccur = inputs.reduce((product, otherValue, otherIndex) => {
        return otherIndex === index ? product : product * (1 - otherValue);
      }, 1);
      return sum + value * othersDoNotOccur;
    }, 0);
  }

  return null;
}

function getNodeProbability(node, issues) {
  if (node.type === "GATE") {
    if (node.gateType === "K_OUT_OF_N") {
      issues.push(`${node.title || "K/N gate"} needs a K threshold before probability can be calculated.`);
      return null;
    }

    const inputs = node.children.map((child) => getNodeProbability(child, issues));
    if (!inputs.length || inputs.some((value) => value === null)) {
      issues.push(`${node.title || "Gate"} has missing or unsupported probability inputs.`);
      return null;
    }

    return combineProbability(node.gateType, inputs);
  }

  if ((node.type === "TOP_EVENT" || node.type === "INTERMEDIATE_EVENT") && node.children.length > 0) {
    const inputs = node.children.map((child) => getNodeProbability(child, issues));
    if (inputs.some((value) => value === null)) {
      issues.push(`${node.title || typeLabels[node.type]} has incomplete child probabilities.`);
      return null;
    }
    if (inputs.length === 1) return inputs[0];
    return combineProbability("OR", inputs);
  }

  const ownProbability = parseProbability(node.probability || "");
  if (ownProbability === null) {
    issues.push(`${node.title || typeLabels[node.type]} has no parseable probability.`);
  }
  return ownProbability;
}

function analyzeTree(tree) {
  const countsByType = Object.fromEntries(nodeTypeOptions.map((option) => [option.value, 0]));
  const countsByGate = Object.fromEntries(gateTypeOptions.map((option) => [option.value, 0]));
  const leafTypes = new Set(["BASIC_EVENT", "UNDEVELOPED_EVENT", "TRANSFER_IN", "TRANSFER_OUT", "INTERMEDIATE_EVENT"]);
  const issues = [];
  const ruleViolations = collectRuleViolations(tree);
  let totalNodes = 0;
  let leafCount = 0;
  let terminalEventCount = 0;
  let terminalEventsWithProbability = 0;
  let maxDepth = 0;
  let maxChildren = 0;

  function visit(node, depth) {
    totalNodes += 1;
    countsByType[node.type] = (countsByType[node.type] || 0) + 1;
    maxDepth = Math.max(maxDepth, depth);
    maxChildren = Math.max(maxChildren, node.children.length);

    if (node.type === "GATE") {
      countsByGate[node.gateType] = (countsByGate[node.gateType] || 0) + 1;
    }

    if (node.children.length === 0) {
      leafCount += 1;
      if (leafTypes.has(node.type)) {
        terminalEventCount += 1;
        if (parseProbability(node.probability || "") !== null) {
          terminalEventsWithProbability += 1;
        }
      }
    }

    node.children.forEach((child) => visit(child, depth + 1));
  }

  visit(tree, 1);
  const topProbability = getNodeProbability(tree, issues);
  const uniqueIssues = [...new Set(issues)];

  return {
    countsByGate,
    countsByType,
    leafCount,
    maxChildren,
    maxDepth,
    probabilityCoverage: terminalEventCount === 0 ? 0 : terminalEventsWithProbability / terminalEventCount,
    probabilityIssues: uniqueIssues,
    ruleViolations,
    terminalEventCount,
    terminalEventsWithProbability,
    topProbability,
    totalNodes,
  };
}

function getTreeValidationReport(tree) {
  const analysis = analyzeTree(tree);
  const structureIssues = [...new Set(collectStructureCompletionIssues(tree))];

  return {
    calculationIssues: analysis.probabilityIssues,
    ruleViolations: analysis.ruleViolations,
    structureIssues,
    totalIssues: analysis.ruleViolations.length + structureIssues.length + analysis.probabilityIssues.length,
  };
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getNodeTypeText(node) {
  return node.type === "GATE"
    ? `${gateTypeLabels[node.gateType] || node.gateType} gate`
    : typeLabels[node.type] || node.type;
}

function collectTreeSearchResults(node, query, path = [], results = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return results;

  const title = getNodeDisplayName(node);
  const nextPath = [...path, title];
  const typeText = getNodeTypeText(node);
  const fields = [
    title,
    node.description,
    node.probability,
    node.id,
    typeText,
    nextPath.join(" "),
  ];
  const searchableText = normalizeSearchText(fields.filter(Boolean).join(" "));

  if (searchableText.includes(normalizedQuery)) {
    results.push({
      id: node.id,
      node,
      path: nextPath,
      title,
      typeText,
    });
  }

  node.children.forEach((child) => collectTreeSearchResults(child, query, nextPath, results));
  return results;
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
    type: node.type === "TRANSFER_EVENT" ? "TRANSFER_OUT" : node.type,
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

function getSymbolPalette(node) {
  if (node.type === "TOP_EVENT") return "bg-violet-100 ring-violet-200 text-violet-800";
  if (node.type === "GATE") return "bg-sky-100 ring-sky-200 text-sky-800";
  if (node.type === "BASIC_EVENT") return "bg-rose-100 ring-rose-200 text-rose-800";
  if (node.type === "INTERMEDIATE_EVENT") return "bg-amber-100 ring-amber-200 text-amber-800";
  if (node.type === "UNDEVELOPED_EVENT") return "bg-orange-100 ring-orange-200 text-orange-800";
  if (node.type === "TRANSFER_IN" || node.type === "TRANSFER_OUT") return "bg-cyan-100 ring-cyan-200 text-cyan-800";
  if (node.type === "DORMANT_EVENT") return "bg-rose-100 ring-rose-200 text-rose-800";
  if (node.type === "HOUSE_EVENT") return "bg-emerald-100 ring-emerald-200 text-emerald-800";
  if (node.type === "CONDITIONAL_EVENT") return "bg-yellow-100 ring-yellow-200 text-yellow-800";
  return "bg-slate-100 ring-slate-200 text-slate-700";
}

function GateBadge({ node }) {
  const symbol = node.type === "GATE" ? symbolByGateType[node.gateType] : symbolByNodeType[node.type];
  const label = node.type === "GATE" ? gateTypeLabels[node.gateType] || node.gateType : typeLabels[node.type] || node.type;
  const palette = getSymbolPalette(node);

  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ${palette}`} title={label}>
      {symbol ? (
        <img className="h-6 w-6" src={symbol} alt="" draggable={false} aria-hidden="true" />
      ) : (
        <span className="text-[10px] font-bold">{node.gateType || node.type}</span>
      )}
    </div>
  );
}

function getLegendFallbackText(type, gateType = null) {
  if (!gateType) return type === "GATE" ? "GATE" : typeLabels[type]?.slice(0, 3).toUpperCase() || type;
  if (gateType === "K_OUT_OF_N") return "K/N";
  if (gateType === "PRIORITY_AND") return "PAND";
  if (gateType === "SEQUENTIAL") return "SEQ";
  if (gateType === "SPARE") return "SP";
  return gateTypeLabels[gateType] || gateType;
}

function LegendSymbol({ type, gateType = null }) {
  const symbol = gateType ? symbolByGateType[gateType] : symbolByNodeType[type];
  const label = gateType ? gateTypeLabels[gateType] || gateType : typeLabels[type] || type;
  const palette = getSymbolPalette({ type: gateType ? "GATE" : type });

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ${palette}`} title={label}>
      {symbol ? (
        <img className="h-7 w-7" src={symbol} alt="" draggable={false} aria-hidden="true" />
      ) : (
        <span className="text-[9px] font-bold">{getLegendFallbackText(type, gateType)}</span>
      )}
    </div>
  );
}

function NodeMeta({ node }) {
  const typeText = node.type === "GATE"
    ? `${gateTypeLabels[node.gateType] || node.gateType} gate`
    : typeLabels[node.type] || node.type;
  return (
    <p className="truncate text-xs text-slate-500">
      {typeText}{node.probability ? ` · P=${node.probability}` : ""}
    </p>
  );
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

function ValidationIssueSection({ title, issues }) {
  if (issues.length === 0) return null;

  return (
    <section className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <ul className="mt-2 space-y-2">
        {issues.map((issue, index) => (
          <li key={`${title}-${index}-${issue}`} className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-snug text-red-900">
            {issue}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ValidationModal({ tree, open, onClose }) {
  const report = useMemo(() => getTreeValidationReport(tree), [tree]);
  const hasIssues = report.totalIssues > 0;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="validation-backdrop"
            className="fixed inset-0 z-[80] bg-slate-950/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="validation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="validation-dialog-title"
            className="fixed inset-x-4 top-20 z-[90] mx-auto max-h-[78vh] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Validation</p>
                <h2 id="validation-dialog-title" className="text-lg font-bold text-slate-950">
                  {hasIssues ? `${report.totalIssues} issue${report.totalIssues === 1 ? "" : "s"} found` : "No validation errors found"}
                </h2>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={onClose}
                aria-label="Close validation results"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!hasIssues ? (
              <div className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">
                The tree passes the current structural and calculation checks.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <ValidationIssueSection title="FTA rule errors" issues={report.ruleViolations} />
                <ValidationIssueSection title="Incomplete structure" issues={report.structureIssues} />
                <ValidationIssueSection title="Calculation gaps" issues={report.calculationIssues} />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function LegendItem({ children, description, label, meta, symbol }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      {symbol}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-slate-950">{label}</p>
          {meta && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{meta}</span>}
        </div>
        {description && <p className="mt-1 text-xs leading-snug text-slate-500">{description}</p>}
        {children}
      </div>
    </div>
  );
}

function HelpLegendModal({ open, onClose }) {
  const ruleNotes = [
    "Top and intermediate events are developed through a single child gate.",
    "Gates connect input events and enforce the selected logical operator.",
    "Primary, house, conditional, and transfer-in events are terminal inputs.",
    "Transfer-out events mark a continuation that may be developed through a gate.",
  ];

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="help-backdrop"
            className="fixed inset-0 z-[80] bg-slate-950/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-dialog-title"
            className="fixed inset-x-4 top-12 z-[90] mx-auto max-h-[84vh] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reference</p>
                <h2 id="help-dialog-title" className="text-lg font-bold text-slate-950">Help / Legend</h2>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={onClose}
                aria-label="Close help and legend"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <section>
                <h3 className="text-sm font-bold text-slate-950">Node Symbols</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {nodeTypeOptions.map((option) => {
                    const config = getNodeTypeConfig(option.value);
                    return (
                      <LegendItem
                        key={option.value}
                        label={option.label}
                        meta={config?.category}
                        description={config?.description}
                        symbol={<LegendSymbol type={option.value} />}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-bold text-slate-950">Gate Operators</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {gateTypeOptions.map((option) => {
                    const config = getGateTypeConfig(option.value);
                    return (
                      <LegendItem
                        key={option.value}
                        label={option.label}
                        meta={option.category}
                        description={config?.description}
                        symbol={<LegendSymbol type="GATE" gateType={option.value} />}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-bold text-slate-950">Rule Notes</h3>
                <div className="mt-2 grid gap-2">
                  {ruleNotes.map((note) => (
                    <div key={note} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-snug text-slate-700">
                      {note}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SearchModal({ tree, open, onClose, onSelectResult }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const trimmedQuery = query.trim();
  const results = useMemo(() => collectTreeSearchResults(tree, query).slice(0, 60), [tree, query]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="search-backdrop"
            className="fixed inset-0 z-[80] bg-slate-950/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-dialog-title"
            className="fixed inset-x-4 top-16 z-[90] mx-auto max-h-[80vh] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tree search</p>
                  <h2 id="search-dialog-title" className="text-lg font-bold text-slate-950">Find nodes</h2>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  onClick={onClose}
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-indigo-400">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  ref={inputRef}
                  className="min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles, descriptions, types, gates..."
                />
              </label>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-4">
              {!trimmedQuery ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Start typing to search the fault tree.
                </p>
              ) : results.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  No matching nodes found.
                </p>
              ) : (
                <div className="grid gap-2">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      onClick={() => {
                        onSelectResult(result.id);
                        onClose();
                      }}
                    >
                      <GateBadge node={result.node} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-bold text-slate-950">{result.title}</p>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                            {result.typeText}
                          </span>
                        </div>
                        {result.node.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">{result.node.description}</p>
                        )}
                        <p className="mt-2 truncate text-xs text-slate-400">{result.path.join(" / ")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatTile({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function AnalysisView({ tree }) {
  const analysis = useMemo(() => analyzeTree(tree), [tree]);
  const coveragePercent = Math.round(analysis.probabilityCoverage * 100);
  const populatedTypeCounts = nodeTypeOptions.filter((option) => analysis.countsByType[option.value] > 0);
  const populatedGateCounts = gateTypeOptions.filter((option) => analysis.countsByGate[option.value] > 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Top event estimate" value={formatProbability(analysis.topProbability)} detail="Independent-input approximation" />
        <StatTile label="Probability coverage" value={`${coveragePercent}%`} detail={`${analysis.terminalEventsWithProbability}/${analysis.terminalEventCount} terminal events`} />
        <StatTile label="Tree depth" value={analysis.maxDepth} detail={`${analysis.leafCount} leaf nodes`} />
        <StatTile label="Largest fan-in" value={analysis.maxChildren} detail="Most direct children on one node" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <GitFork className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-950">Structure</h2>
        </div>
        <div className="grid gap-2">
          {populatedTypeCounts.map((option) => {
            const count = analysis.countsByType[option.value];
            const width = `${Math.max(6, (count / analysis.totalNodes) * 100)}%`;
            return (
              <div key={option.value} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{option.label}</span>
                  <span className="tabular-nums text-slate-500">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-700" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-950">Gates</h2>
        </div>
        {populatedGateCounts.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {populatedGateCounts.map((option) => (
              <div key={option.value} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{option.label}</span>
                <span className="tabular-nums text-slate-500">{analysis.countsByGate[option.value]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No gates in this tree.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-950">Checks</h2>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">FTA rule violations</span>
            <span className={`tabular-nums ${analysis.ruleViolations.length ? "text-red-600" : "text-emerald-700"}`}>{analysis.ruleViolations.length}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">Calculation gaps</span>
            <span className={`tabular-nums ${analysis.probabilityIssues.length ? "text-amber-600" : "text-emerald-700"}`}>{analysis.probabilityIssues.length}</span>
          </div>
        </div>
        {analysis.probabilityIssues.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {analysis.probabilityIssues.slice(0, 4).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SettingsView({
  darkMode,
  onToggleDarkMode,
  assumptionText,
  onAssumptionTextChange,
  modellingBoundary,
  onModellingBoundaryChange,
  gateAvailability,
  onToggleGateAvailability,
  onImport,
  onExport,
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <div className="mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-950 dark:text-slate-100">Settings</h2>
        </div>
        <div className="grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dark mode</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Switch the app between light and dark appearance.</p>
              </div>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${darkMode ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}
                onClick={onToggleDarkMode}
              >
                {darkMode ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Assumptions</p>
            <textarea
              className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={assumptionText}
              onChange={(event) => onAssumptionTextChange(event.target.value)}
              placeholder="Describe the assumptions for this model..."
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Model boundaries</p>
            <textarea
              className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={modellingBoundary}
              onChange={(event) => onModellingBoundaryChange(event.target.value)}
              placeholder="Define the modelling boundary for this fault tree..."
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Gate availability</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {gateTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={Boolean(gateAvailability[option.value])}
                    onChange={() => onToggleGateAvailability(option.value)}
                  />
                  <span className="min-w-0 flex-1">{option.label}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {option.category.toLowerCase()}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Choose which individual gate types appear in the gate picker.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import / export</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                onClick={onImport}
              >
                Import tree
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                onClick={onExport}
              >
                Export tree
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TreeToolbarButton({ disabled = false, label, icon: Icon, onClick }) {
  const isReady = typeof onClick === "function";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-full min-w-0 rounded-lg px-0 text-slate-700"
      onClick={onClick}
      disabled={!isReady || disabled}
      aria-label={label}
      title={isReady ? label : `${label} planned`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function TreeToolbar({
  canRedo = false,
  canUndo = false,
  onUndo,
  onRedo,
  onExpandAll,
  onCollapseAll,
  onSearch,
  onHelp,
  onValidate,
}) {
  const toolbarActions = [
    { label: "Undo", icon: Undo2, onClick: onUndo, disabled: !canUndo },
    { label: "Redo", icon: Redo2, onClick: onRedo, disabled: !canRedo },
    { label: "Expand all", icon: ChevronsUpDown, onClick: onExpandAll },
    { label: "Collapse all", icon: ChevronsDownUp, onClick: onCollapseAll },
    { label: "Search", icon: Search, onClick: onSearch },
    { label: "Help and legend", icon: CircleQuestionMark, onClick: onHelp },
    { label: "Validate", icon: ListChecks, onClick: onValidate },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
      aria-label="Tree toolbar"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-7 gap-1">
        {toolbarActions.map((action) => (
          <TreeToolbarButton key={action.label} {...action} />
        ))}
      </div>
    </nav>
  );
}

function TreeNode({
  node,
  rootId,
  depth,
  selectedId,
  draggedId,
  dragOverId,
  dragOverValid,
  onSelect,
  onToggle,
  onAddChild,
  onDragStart,
  onDragOverNode,
  onDragLeaveNode,
  onDropNode,
  onDragEnd,
  onPointerDragStart,
  onPointerDragMove,
  onPointerDragEnd,
  onPointerDragCancel,
}) {
  const hasChildren = node.children.length > 0;
  const selected = selectedId === node.id;
  const draggable = node.id !== rootId;
  const isDragging = draggedId === node.id;
  const isDropTarget = dragOverId === node.id && draggedId !== node.id;
  const missingActions = getMissingChildActions(node);
  const stateClass = isDropTarget
    ? dragOverValid
      ? "border-emerald-400 ring-2 ring-emerald-100"
      : "border-red-400 ring-2 ring-red-100"
    : selected
    ? "border-indigo-400 ring-2 ring-indigo-100"
    : missingActions.length
    ? "border-red-300 bg-red-50"
    : "border-slate-200";

  return (
    <div className="relative">
      <motion.div
        layout
        data-node-drop-id={node.id}
        onDragOver={(event) => onDragOverNode(event, node.id)}
        onDragLeave={(event) => onDragLeaveNode(event, node.id)}
        onDrop={(event) => onDropNode(event, node.id)}
        className={`mb-2 rounded-2xl border bg-white shadow-sm transition ${stateClass} ${isDragging ? "opacity-50" : ""}`}
        style={{ marginLeft: depth * 18 }}
      >
        <div className="flex w-full items-center gap-2 p-3 text-left">
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500"
            onClick={() => {
              if (hasChildren) onToggle(node.id);
            }}
            aria-label="Toggle node"
            type="button"
          >
            {hasChildren ? node.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : <GitBranch className="h-4 w-4 opacity-30" />}
          </button>
          <button
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            onClick={() => onSelect(node.id)}
            type="button"
          >
            <GateBadge node={node} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">{node.title || "Untitled node"}</p>
              </div>
              <NodeMeta node={node} />
            </div>
          </button>
          <div
            className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition ${draggable ? "cursor-grab hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing" : "cursor-not-allowed opacity-35"}`}
            draggable={draggable}
            onDragStart={(event) => onDragStart(event, node.id)}
            onDragEnd={onDragEnd}
            onPointerDown={(event) => onPointerDragStart(event, node.id)}
            onPointerMove={onPointerDragMove}
            onPointerUp={onPointerDragEnd}
            onPointerCancel={onPointerDragCancel}
            onClick={(event) => event.stopPropagation()}
            role="button"
            tabIndex={draggable ? 0 : -1}
            aria-label={draggable ? `Drag ${node.title || "node"}` : "Top event cannot be moved"}
            aria-grabbed={isDragging ? "true" : undefined}
            title={draggable ? "Drag node" : "Top event cannot be moved"}
            style={{ touchAction: draggable ? "none" : "auto" }}
          >
            <GripVertical className="h-5 w-5" />
          </div>
        </div>
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
                rootId={rootId}
                depth={depth + 1}
                selectedId={selectedId}
                draggedId={draggedId}
                dragOverId={dragOverId}
                dragOverValid={dragOverValid}
                onSelect={onSelect}
                onToggle={onToggle}
                onAddChild={onAddChild}
                onDragStart={onDragStart}
                onDragOverNode={onDragOverNode}
                onDragLeaveNode={onDragLeaveNode}
                onDropNode={onDropNode}
                onDragEnd={onDragEnd}
                onPointerDragStart={onPointerDragStart}
                onPointerDragMove={onPointerDragMove}
                onPointerDragEnd={onPointerDragEnd}
                onPointerDragCancel={onPointerDragCancel}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {missingActions.length > 0 && (
        <div
          className="mb-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-slate-700"
          style={{ marginLeft: depth * 18 }}
        >
          <div className="mb-2 text-sm font-semibold text-slate-900">Incomplete structure</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {missingActions.map((action) => (
              <Button
                key={action.type}
                className="rounded-2xl"
                variant="outline"
                onClick={() => onAddChild(node.id, null, action.type)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BottomDrawer({ selected, rootId, parentNode, gateAvailability, onClose, onSave, onAddChild, onDelete, onRuleViolation }) {
  const [draft, setDraft] = useState(selected);
  const [validationError, setValidationError] = useState("");

  if (!selected || !draft) return null;

  const canHaveGate = draft.type === "GATE";
  const canAddChildren = canHaveChildren(draft.type);
  const availableGateTypeOptions = gateTypeOptions.filter((option) => gateAvailability[option.value]);

  return (
    <AnimatePresence>
      <motion.div
        key="drawer-backdrop"
        className="fixed inset-0 z-40 bg-slate-950/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key={`drawer-panel-${selected.id}`}
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
                    nextDraft.gateType = availableGateTypeOptions.some((option) => option.value === draft.gateType)
                      ? draft.gateType
                      : availableGateTypeOptions[0]?.value || "AND";
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
                value={availableGateTypeOptions.some((option) => option.value === draft.gateType) ? draft.gateType : ""}
                disabled={!canHaveGate || availableGateTypeOptions.length === 0}
                onChange={(e) => setDraft({ ...draft, gateType: e.target.value })}
              >
                {availableGateTypeOptions.map((option) => (
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
  const [activeView, setActiveView] = useState("tree");
  const [selectedId, setSelectedId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [assumptionText, setAssumptionText] = useState("");
  const [modellingBoundary, setModellingBoundary] = useState("");
  const [gateAvailability, setGateAvailability] = useState(defaultGateAvailability);
  const [storageStatus, setStorageStatus] = useState("loading");
  const [importError, setImportError] = useState("");
  const [ruleFeedback, setRuleFeedback] = useState(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverValid, setDragOverValid] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const fileInputRef = useRef(null);
  const pointerDragRef = useRef(null);
  const selected = selectedId ? findNode(tree, selectedId) : null;
  const selectedParent = selectedId ? findParentNode(tree, selectedId) : null;
  const nodeCount = useMemo(() => flattenCount(tree), [tree]);
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const showRuleFeedback = (message) => {
    setRuleFeedback({ id: uid(), message });
  };

  const getCurrentSnapshot = () => ({ tree, selectedId });

  const restoreSnapshot = (snapshot) => {
    setTree(snapshot.tree);
    setSelectedId(snapshot.selectedId && findNode(snapshot.tree, snapshot.selectedId) ? snapshot.selectedId : null);
    setDraggedId(null);
    setDragOverId(null);
    setDragOverValid(false);
    pointerDragRef.current = null;
  };

  const commitTreeChange = (updater, options = {}) => {
    const nextTree = typeof updater === "function" ? updater(tree) : updater;
    if (areTreesEqual(tree, nextTree)) return false;

    const requestedSelectedId = Object.prototype.hasOwnProperty.call(options, "nextSelectedId") ? options.nextSelectedId : selectedId;
    const nextSelectedId = requestedSelectedId && findNode(nextTree, requestedSelectedId) ? requestedSelectedId : null;

    setUndoStack((history) => [...history, getCurrentSnapshot()].slice(-TREE_HISTORY_LIMIT));
    setRedoStack([]);
    setTree(nextTree);
    setSelectedId(nextSelectedId);
    return true;
  };

  const undoTreeChange = () => {
    if (!canUndo) return;

    const previousSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((history) => history.slice(0, -1));
    setRedoStack((history) => [...history, getCurrentSnapshot()].slice(-TREE_HISTORY_LIMIT));
    restoreSnapshot(previousSnapshot);
  };

  const redoTreeChange = () => {
    if (!canRedo) return;

    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((history) => history.slice(0, -1));
    setUndoStack((history) => [...history, getCurrentSnapshot()].slice(-TREE_HISTORY_LIMIT));
    restoreSnapshot(nextSnapshot);
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
    commitTreeChange(updateNode(tree, id, { expanded: !node.expanded }));
  };

  const expandAllNodes = () => {
    commitTreeChange((currentTree) => setTreeExpanded(currentTree, true));
  };

  const collapseAllNodes = () => {
    commitTreeChange((currentTree) => setTreeExpanded(currentTree, false));
  };

  const selectSearchResult = (nodeId) => {
    setActiveView("tree");
    setTree((currentTree) => expandNodePath(currentTree, nodeId));
    setSelectedId(nodeId);
  };

  const startNodeDrag = (event, nodeId) => {
    if (nodeId === tree.id) {
      event.preventDefault();
      showRuleFeedback(formatRuleMessage("The top event cannot be moved"));
      return;
    }

    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_NODE_MIME_TYPE, nodeId);
    event.dataTransfer.setData("text/plain", nodeId);
    setDraggedId(nodeId);
    setDragOverId(null);
    setDragOverValid(false);
  };

  const startNodePointerDrag = (event, nodeId) => {
    if (event.pointerType === "mouse") return;

    if (nodeId === tree.id) {
      event.preventDefault();
      event.stopPropagation();
      showRuleFeedback(formatRuleMessage("The top event cannot be moved"));
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDragRef.current = {
      nodeId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      targetParentId: null,
      targetValid: false,
    };
    setDraggedId(nodeId);
    setDragOverId(null);
    setDragOverValid(false);
  };

  const dragOverNode = (event, nodeId) => {
    if (!draggedId) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const ruleCheck = validateMoveNode(tree, draggedId, nodeId);
    setDragOverId(nodeId);
    setDragOverValid(ruleCheck.valid);
  };

  const leaveDraggedNode = (event, nodeId) => {
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget)) return;

    if (dragOverId === nodeId) {
      setDragOverId(null);
      setDragOverValid(false);
    }
  };

  const finishNodeDrag = () => {
    pointerDragRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setDragOverValid(false);
  };

  const updatePointerDropTarget = (event, dragSession) => {
    const targetParentId = getNodeDropTargetIdAtPoint(event.clientX, event.clientY);
    dragSession.targetParentId = targetParentId;

    if (!targetParentId) {
      dragSession.targetValid = false;
      setDragOverId(null);
      setDragOverValid(false);
      return;
    }

    const ruleCheck = validateMoveNode(tree, dragSession.nodeId, targetParentId);
    dragSession.targetValid = ruleCheck.valid;
    setDragOverId(targetParentId);
    setDragOverValid(ruleCheck.valid);
  };

  const moveNodePointerDrag = (event) => {
    const dragSession = pointerDragRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const distance = Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY);
    if (!dragSession.hasMoved && distance < 8) return;

    dragSession.hasMoved = true;
    updatePointerDropTarget(event, dragSession);
  };

  const endNodePointerDrag = (event) => {
    const dragSession = pointerDragRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!dragSession.hasMoved) {
      finishNodeDrag();
      return;
    }

    const targetParentId = getNodeDropTargetIdAtPoint(event.clientX, event.clientY) || dragSession.targetParentId;
    if (!targetParentId) {
      finishNodeDrag();
      return;
    }

    const ruleCheck = validateMoveNode(tree, dragSession.nodeId, targetParentId);
    if (!ruleCheck.valid) {
      showRuleFeedback(ruleCheck.error);
      finishNodeDrag();
      return;
    }

    commitTreeChange(moveNode(tree, dragSession.nodeId, targetParentId), { nextSelectedId: dragSession.nodeId });
    finishNodeDrag();
  };

  const cancelNodePointerDrag = (event) => {
    const dragSession = pointerDragRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishNodeDrag();
  };

  const dropNode = (event, targetParentId) => {
    event.preventDefault();
    event.stopPropagation();

    const movedId = event.dataTransfer.getData(DRAG_NODE_MIME_TYPE) || event.dataTransfer.getData("text/plain") || draggedId;
    if (!movedId) {
      finishNodeDrag();
      return;
    }

    const ruleCheck = validateMoveNode(tree, movedId, targetParentId);
    if (!ruleCheck.valid) {
      showRuleFeedback(ruleCheck.error);
      finishNodeDrag();
      return;
    }

    commitTreeChange(moveNode(tree, movedId, targetParentId), { nextSelectedId: movedId });
    finishNodeDrag();
  };

  const saveNode = (draft) => {
    const currentNode = findNode(tree, draft.id);
    const parentNode = findParentNode(tree, draft.id);
    const ruleCheck = validateNodeTypeChange(currentNode || draft, draft.type, parentNode, draft.id === tree.id);
    if (!ruleCheck.valid) {
      showRuleFeedback(ruleCheck.error);
      return ruleCheck;
    }

    commitTreeChange(updateNode(tree, draft.id, getNodePatch(draft)), { nextSelectedId: draft.id });
    return { valid: true };
  };

  const addNewChild = (parentId, parentDraft = null, explicitChildType = null) => {
    const savedParentNode = findNode(tree, parentId);
    if (!savedParentNode) return { valid: false, error: "Parent node was not found." };
    const parentNode = parentDraft || savedParentNode;
    const parentOfParent = findParentNode(tree, parentId);
    const parentRuleCheck = validateNodeTypeChange(savedParentNode, parentNode.type, parentOfParent, parentId === tree.id);
    if (!parentRuleCheck.valid) {
      showRuleFeedback(parentRuleCheck.error);
      return parentRuleCheck;
    }

    let childType = explicitChildType || "BASIC_EVENT";
    let childTitle = "New basic event";

    if (["TOP_EVENT", "INTERMEDIATE_EVENT", "TRANSFER_OUT"].includes(parentNode.type)) {
      childType = explicitChildType || "GATE";
      childTitle = "New gate";
    }

    if (parentNode.type === "GATE" && !explicitChildType) {
      childType = "BASIC_EVENT";
      childTitle = "New basic event";
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
    commitTreeChange(addChild(nextTree, parentId, child), { nextSelectedId: child.id });
    return { valid: true };
  };

  const removeNode = (id) => {
    commitTreeChange(deleteNode(tree, id), { nextSelectedId: null });
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
        commitTreeChange(normalized, { nextSelectedId: null });
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
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.16),_transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef2ff_100%)] text-slate-950 dark:bg-slate-950 dark:text-slate-100`}>
      <div className="mx-auto flex min-h-screen w-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">Fault Tree Analysis</p>
              <p className="truncate text-xs text-slate-500">{statusLabel} · {nodeCount} nodes</p>
            </div>
            <div className="grid w-32 shrink-0 grid-cols-3 rounded-md bg-slate-100 p-0.5">
              <button
                className={`flex h-7 items-center justify-center gap-1 rounded text-xs font-semibold transition ${activeView === "tree" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                onClick={() => setActiveView("tree")}
                type="button"
              >
                <GitBranch className="h-3.5 w-3.5" />
              </button>
              <button
                className={`flex h-7 items-center justify-center gap-1 rounded text-xs font-semibold transition ${activeView === "analysis" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                onClick={() => setActiveView("analysis")}
                type="button"
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </button>
              <button
                className={`flex h-7 items-center justify-center gap-1 rounded text-xs font-semibold transition ${activeView === "settings" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                onClick={() => setActiveView("settings")}
                type="button"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {importError && <p className="text-xs text-red-600">{importError}</p>}
        </header>
        <RuleFeedback feedback={ruleFeedback} onDismiss={() => setRuleFeedback(null)} />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-2 pt-0">

        <main className={`flex-1 space-y-4 px-0 pt-4 ${activeView === "tree" ? "pb-20" : "pb-4"}`}>
          {activeView === "tree" ? (
            <TreeNode
              node={tree}
              rootId={tree.id}
              depth={0}
              selectedId={selectedId}
              draggedId={draggedId}
              dragOverId={dragOverId}
              dragOverValid={dragOverValid}
              onSelect={setSelectedId}
              onToggle={toggleNode}
              onAddChild={addNewChild}
              gateAvailability={gateAvailability}
              onDragStart={startNodeDrag}
              onDragOverNode={dragOverNode}
              onDragLeaveNode={leaveDraggedNode}
              onDropNode={dropNode}
              onDragEnd={finishNodeDrag}
              onPointerDragStart={startNodePointerDrag}
              onPointerDragMove={moveNodePointerDrag}
              onPointerDragEnd={endNodePointerDrag}
              onPointerDragCancel={cancelNodePointerDrag}
            />
          ) : activeView === "analysis" ? (
            <AnalysisView tree={tree} />
          ) : (
            <SettingsView
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode((value) => !value)}
              assumptionText={assumptionText}
              onAssumptionTextChange={setAssumptionText}
              modellingBoundary={modellingBoundary}
              onModellingBoundaryChange={setModellingBoundary}
              gateAvailability={gateAvailability}
              onToggleGateAvailability={(gateType) =>
                setGateAvailability((prev) => {
                  const enabledCount = Object.values(prev).filter(Boolean).length;
                  if (prev[gateType] && enabledCount === 1) return prev;
                  return { ...prev, [gateType]: !prev[gateType] };
                })
              }
              onImport={importJson}
              onExport={exportJson}
            />
          )}
        </main>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        {activeView === "tree" && (
          <TreeToolbar
            canRedo={canRedo}
            canUndo={canUndo}
            onRedo={redoTreeChange}
            onUndo={undoTreeChange}
            onExpandAll={expandAllNodes}
            onCollapseAll={collapseAllNodes}
            onSearch={() => setSearchOpen(true)}
            onHelp={() => setHelpOpen(true)}
            onValidate={() => setValidationOpen(true)}
          />
        )}
      </div>
      </div>

      <ValidationModal tree={tree} open={validationOpen} onClose={() => setValidationOpen(false)} />
      <HelpLegendModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SearchModal
        tree={tree}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectResult={selectSearchResult}
      />

      {selected && (
        <BottomDrawer
          key={`${selected.id}-${selected.type}-${selected.gateType || ""}-${selected.title || ""}-${selected.description || ""}-${selected.probability || ""}`}
          selected={selected}
          rootId={tree.id}
          parentNode={selectedParent}
          gateAvailability={gateAvailability}
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
