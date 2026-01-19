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
    _derived_nodes: List[Proposition]
    _justification: str

    def __init__(self, premises: List[Proposition], conclusion: Proposition, is_premise: bool, inference_rule: Union[None, str]) -> None:
        """
        Make a new proof node!

        If this proposition is a premise, then instantiate a new proof node. It is already true
        If this proposition is a conclusion, provide premises and validate before instantiating
        """
        if is_premise:
            self._conclusion = conclusion
            self._derived_nodes = []
        else:

            # Need to check if the conclusion is valid
            justification, justified = justify(premises, conclusion, inference_rule)
            if justified:
                self._conclusion = conclusion
                self._derived_nodes = premises
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





