from __future__ import annotations
from typing import Union, Any
from expression import Expr
from sympy import *

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


class And(Proposition):
    """
    A proposition that consists of two propositions connected by logical AND.

    === Attributes ===
    self.left: Proposition
    self.right: Proposition
    """
    left: Proposition
    right: Proposition

    def __init__(self, left: Proposition, right: Proposition):
        """
        Create a new AND proposition.

        === Precondition ===
        left and right are Proposition instances
        """
        self.left = left
        self.right = right

    def evaluate(self) -> bool:
        """
        Return the boolean value of left AND right.
        """
        left_val = self.left.evaluate()
        right_val = self.right.evaluate()
        return left_val and right_val


class Or(Proposition):
    """
    A proposition that consists of two propositions connected by logical OR.

    === Attributes ===
    self.left: Proposition
    self.right: Proposition
    """
    left: Proposition
    right: Proposition

    def __init__(self, left: Proposition, right: Proposition):
        """
        Create a new OR proposition.

        === Precondition ===
        left and right are Proposition instances
        """
        self.left = left
        self.right = right

    def evaluate(self) -> bool:
        """
        Return the boolean value of left OR right.
        """
        left_val = self.left.evaluate()
        right_val = self.right.evaluate()
        return left_val or right_val


class Implies(Proposition):
    """
    A proposition that consists of two propositions connected by logical IMPLIES.

    === Attributes ===
    self.left: Proposition (antecedent)
    self.right: Proposition (consequent)
    """
    left: Proposition
    right: Proposition

    def __init__(self, left: Proposition, right: Proposition):
        """
        Create a new IMPLIES proposition.

        === Precondition ===
        left and right are Proposition instances
        """
        self.left = left
        self.right = right

    def evaluate(self) -> bool:
        """
        Return the boolean value of left IMPLIES right.
        """
        left_val = self.left.evaluate()
        right_val = self.right.evaluate()
        return False if (left_val is True and right_val is False) else True


class Iff(Proposition):
    """
    A proposition that consists of two propositions connected by logical IF AND ONLY IF.

    === Attributes ===
    self.left: Proposition
    self.right: Proposition
    """
    left: Proposition
    right: Proposition

    def __init__(self, left: Proposition, right: Proposition):
        """
        Create a new IF AND ONLY IF proposition.

        === Precondition ===
        left and right are Proposition instances
        """
        self.left = left
        self.right = right

    def evaluate(self) -> bool:
        """
        Return the boolean value of left IF AND ONLY IF right.
        """
        left_val = self.left.evaluate()
        right_val = self.right.evaluate()
        return True if ((left_val is True and right_val is True) or (left_val is False and right_val is False)) else False


class Not(Proposition):
    """
    A proposition that consists of a negated proposition.

    === Attributes ===
    self.prop: Proposition
    """
    prop: Proposition

    def __init__(self, prop: Proposition):
        """
        Create a new NOT proposition.

        === Precondition ===
        prop is a Proposition instance
        """
        self.prop = prop

    def evaluate(self) -> bool:
        """
        Return the boolean value of NOT prop.
        """
        return not self.prop.evaluate()


class ForAll(Proposition):
    """
    A proposition that represents universal quantification: for all x in domain, body holds.

    === Attributes ===
    self.var: the quantified variable
    self.domain: the domain over which the variable is quantified (can be None for unrestricted)
    self.body: Proposition that must hold for all values in the domain
    """
    var: Any
    domain: Any
    body: Proposition

    def __init__(self, var: Any, domain: Any, body: Proposition):
        """
        Create a new FOR ALL proposition.

        === Precondition ===
        body is a Proposition instance
        """
        self.var = var
        self.domain = domain
        self.body = body

    def evaluate(self) -> bool:
        """
        Return the boolean value of FOR ALL var in domain, body.
        """
        raise NotImplementedError


class Exists(Proposition):
    """
    A proposition that represents existential quantification: there exists x in domain such that body holds.

    === Attributes ===
    self.var: the quantified variable
    self.domain: the domain over which the variable is quantified (can be None for unrestricted)
    self.body: Proposition that must hold for at least one value in the domain
    """
    var: Any
    domain: Any
    body: Proposition

    def __init__(self, var: Any, domain: Any, body: Proposition):
        """
        Create a new THERE EXISTS proposition.

        === Precondition ===
        body is a Proposition instance
        """
        self.var = var
        self.domain = domain
        self.body = body

    def evaluate(self) -> bool:
        """
        Return the boolean value of THERE EXISTS var in domain such that body.
        """
        raise NotImplementedError


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

    def evaluate(self) -> bool:
        """
        Check if the left side is equal to the right side. Return True if this holds. Else, return False
        """
        # Left and right expressions in string format
        left_expression = sympify(str(self.left))
        right_expression = sympify(str(self.right))

        # Return boolean if they both evaluate to 0
        return simplify(left_expression - right_expression) == 0


    def __str__(self):
        """
        Return a string representation of this equation
        """
        return f"{self.left.__str__()} {self.root} {self.right.__str__()}"
