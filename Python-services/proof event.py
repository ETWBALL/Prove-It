from __future__ import annotations

from typing import List
from propositions import *


class JustificationError(Exception):
    def __init__(self) -> None:
        super().__init__("Justification error")
        self.message = "Justification error"

    def __str__(self) -> str:
        return f"Can not instantiate a proof node. There is no justification that gives such a conclusion"

def justify(premises, conclusion, justification) -> tuple[str, bool]:
    """
    Return True if the conclusion can be derived from the premises.
    If justification is not None, attempt it.
    If Justification is None, look for the correct justification
    """
    pass # TODO make justify function. It should return the correct inference rule


class ProofTree:
    """
    A recursive tree data structure.
    Represents the entire proof a user writes

    === Private Attributes ===
    _conclusion: A proposition. It is a conclusion if premises' list is not empty
    _derived_nodes: A list containing propositions to conclude the root node. If the self._conclusion is not a conclusion, then _derived_nodes is an empty list.
    _justification: An inference rule or a justification as to why _conclusion is correct.


    === Representation Invariants ===
    In the case that this tree has no children, then self._conclusion is a premise and self._derived_nodes is an empty list.
    Else, self._conclusion is a conclusion.

    All proof nodes are true if they can be derived from subtree nodes.
    """
    _conclusion: Proposition
    _derived_nodes: List[ProofTree]
    _justification: str

    def __init__(self, root: Proposition, subtrees: List[ProofTree], inference_rule: Union[None, str]) -> None:
        """
        Make a new proof node!

        If this proposition <root> is a premise, then instantiate a new proof node. It is already true
        If this proposition <root> is a conclusion, provide premises and validate before instantiating
        """
        if is_premise:
            self._conclusion = root
            self._derived_nodes = []

        else:
            # Need to check if the conclusion is valid
            justification, justified = justify(subtrees, root, inference_rule)
            if justified:
                self._conclusion = root
                self._derived_nodes = subtrees
                self._justification = justification

            if not justified:
                raise JustificationError()

    def is_premise(self) -> bool:
        """
        Return true if there are no derived nodes. Else, false
        """
        return True if not self._derived_nodes else False

    def justify(self) -> str:
        return f"{self._conclusion} is derived from {self.is_premise()}. Justification: {self._justification}"

    def update_current_root(self, conclusion: Proposition) -> None:
        """
        Update this proof tree with a new conclusion.

        However, this conclusion must be justified by the previous conclusion. Otherwise, provide an error
        """
        justification, justified = justify(, conclusion, inference_rule)


class Proof:
    """
    A proof for some proposition, written by the user.

    === Private Attributes ===
    _proof_tree: A tree data structure that holds all propositions. Propositions are true
    _defined_objects: A list of user-defined objects, including variables, functions, sets, etc.
    _undefined_objects: A list of undefined objects the user introduced. This requires a suggestion to the user
    _goal: A proposition that the user wants to prove
    _current_state: The status of the proof, i.e., completed, incompleted, contains errors etc.
    _axioms: A list of axioms that the user can assume true
    _assumptions: A list of assumptions that the user can assume true for all future proofs
    _premises: A list of assumptions that the user can assume true for this current proof instance

    === Representation Invariants ===
    self._current_state can be: (1) <Incomplete> if the proof is not finished, (2) <Complete> if all proof nodes are correct
    and correctly justifies the goal, (3) <Contains Errors> that the user needs to fix.

    The root in self._proof_tree is the current proposition the user is at.
    """
    _proof_tree: ProofTree | None
    _defined_objects: List[Any]
    _undefined_objects: List[Any]
    _goal: Proposition | None
    _current_state: str
    _axioms: List[Any]   #TODO for now, moeez is working on this
    _assumptions: List[Proposition]
    _premises: List[Proposition]

    def __init__(self, goal: Proposition, axioms, assumptions, premises):

        # Firstly, iterate through all propositions and create proof nodes
        for premise in premises:
            premise_node = ProofTree([], premise, is_premise=True, inference_rule=None)

        self._defined_objects = []
        self._undefined_objects = []
        self._current_state = "Incomplete"

        self._goal = goal
        self._axioms = axioms
        self._assumptions = assumptions
        self._premises = premises

        self._proof_tree = None

    def add_proposition(self, proposition: Proposition) -> None:
        """
        A user has created a new proposition.

        Replace the old proposition at the root of self._proof_tree with this. Making the previous root a premise
        """



