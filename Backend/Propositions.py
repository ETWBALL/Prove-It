from __future__ import annotations
from typing import Union, Any

for_all = ' ∀ '
there_exists = ' ∃ '
quantifiers = [for_all, there_exists]


And = ' ∧ '
Not = ' ¬ '
Or = ' ∨ '
Implies = ' ⇒ '
if_and_only_if = ' ⇔ '
connectives = [And, Not, Or, Implies, if_and_only_if]

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


class Expr:
    """An abstract class representing a Python expression.
    """
    def evaluate(self) -> Any:
        """Return the *value* of this expression.

        The returned value should be the result of how this expression would be
        evaluated by the Python interpreter.
        """
        raise NotImplementedError

class Num(Expr):
    """An numeric constant literal.

    === Attributes ===
    n: the value of the constant
    """
    n: Union[int, float]

    def __init__(self, number: Union[int, float]) -> None:
        """Initialize a new numeric constant."""
        self.n = number

    def evaluate(self) -> Any:
        """Return the *value* of this expression.

        The returned value should be the result of how this expression would be
        evaluated by the Python interpreter.

        >>> number = Num(10.5)
        >>> number.evaluate()
        10.5
        """
        return self.n  # Simply return the value itself!

class BinOp(Expr):
    """An arithmetic binary operation.

    === Attributes ===
    left: the left operand
    op: the name of the operator
    right: the right operand

    === Representation Invariants ===
    - self.op == '+' or self.op == '*'
    """
    left: Expr
    op: str
    right: Expr

    def __init__(self, left: Expr, op: str, right: Expr) -> None:
        """Initialize a new binary operation expression.

        Precondition: <op> is the string '+' or '*'.
        """
        self.left = left
        self.op = op
        self.right = right
