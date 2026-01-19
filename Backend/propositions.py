from __future__ import annotations
from typing import Union, Any
from expression import Expr

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

class Proposition:
    """
    An abstract class of a tree consisting of propositions. Checks syntax. The root with no parent is the final proposition.
    """

    def evaluate(self) -> bool:
        """
        Evaluate this proposition and return its output, i.e., True or False.
        """
        raise NotImplementedError

class Binary_Connective(Proposition):
    """
    A proposition that consists of two propositions on the left and right.

    === Attributes ===
    self.left: Proposition
    self.root: string that represents "and"
    self.right: Proposition

    === Representation Invariants ===
    self.root is either "and," "or," "implies," or "double implication"
    """

    left: Proposition
    root: str
    right: Proposition

    def __init__(self, left, right, connective):
        """
        Create a new proposition with the root being "and"

        === Precondition ===
        connective is not "Not"
        """

        self.left = left
        self.root = connective
        self.right = right



    def evaluate(self) -> bool:
        """
        Return the boolean value according to the connective. True or False.
        """
        right, left = self.right.evaluate(), self.left.evaluate()

        if self.root == And:
            return left and right

        if self.root == Or:
            return left or right

        if self.root == Implies:
            return False if (left is True and right is False) else True

        else:
            return True if ((left is True and right is True) or (left is False and right is False)) else False


class UnaryConnective(Proposition):
    """
    A proposition that consists of two propositions on the left or right.

    === Attributes ===
    self.prop: Proposition
    self.ope: An unary connective, i.e., negation
    """
    prop: Proposition
    op: str

    def __init__(self, prop, op):
        self.prop = prop
        self.op = op

    def evaluate(self) -> bool:
        """
        If self.op is a negation, return the correct evaluation.
        """
        # Assuming the only unary operation is a negation

        return not self.prop.evaluate()


class Equation(Proposition):
    """
    A proposition involving a left and a right side. The root is the "=" sign

    === Representation Invariants ===
    self.root is "="
    """
    root: str
    left: Expr
    right: Expr

    def __init__(self, left: Expr, right: Expr, truth: bool) -> None:
        self.root = "="
        self.right = right
        self.left = left

    def __str__(self):
        """
        Return a string representation of this equation
        """
        return f"{self.left.__str__()} {self.root} {self.right.__str__()}"


