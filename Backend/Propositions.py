from __future__ import annotations
from typing import Union, Any
from Expression import Expr

for_all = ' ∀ '
there_exists = ' ∃ '
quantifiers = [for_all, there_exists]


And = ' ∧ '
Not = ' ¬ '
Or = ' ∨ '
Implies = ' ⇒ '
if_and_only_if = ' ⇔ '
connectives = [And, Not, Or, Implies, if_and_only_if]

operators = ['+', '*', '-', '/']

class Predicate:
    """
    A binary tree. The root with no parent is the final proposition
    """
    # the root would store the real proposition, i.e., for all x, P(x)
    root: Any
    left: Union[None, Predicate]
    right: Union[None, Predicate]

    def __init__(self, info: Union[None, str], left: Union[None, Predicate], right: Union[None, Predicate]) -> None:
        if info is None:
            self.root = None
            self.left = None
            self.right = None
        else:
            self.root = info
            self.left = left
            self.right = right



class Proposition:
    """
    A binary tree. The root with no parent is the final proposition
    """
    # the root would store the real proposition, i.e., for all x, P(x)
    root: Any
    truth_value: Union[None, bool]
    left: Union[None, Proposition]
    right: Union[None, Proposition]

    def __init__(self, info, left, right, truth_value) -> None:
        if info is None:
            self.root = None
            self.left = None
            self.right = None
            self.truth_value = None
        else:
            self.root = info
            self.left = left
            self.right = right
            self.truth_value = truth_value

class Equation(Proposition):
    """
    A proposition involving a left and a right side. The root is the "=" sign
    """
    root: str
    left: Expr
    right: Expr

    def __init__(self, left: Expr, right: Expr, truth: bool) -> None:
        super().__init__("=", left, right, truth)

    def __str__(self):
        """
        Return a string representation of this equation
        """
        return f"{self.left.__str__()} {self.root} {self.right.__str__()}"


