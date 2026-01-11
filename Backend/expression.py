
from __future__ import annotations
from sets import Set
from sympy import Symbol
from typing import Union, Any


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
    """A numeric constant literal.

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
        return self.n # Simply return the value itself!

    def __str__(self):
        """
        Return the string representation of this expression.
        >>> number = Num(10.5)
        >>> number.__str__()
        '10.5'
        """
        return f"{self.n}"

class BinOp(Expr):
    """An arithmetic binary operation.

    === Attributes ===
    left: the left operand
    op: the name of the operator
    right: the right operand

    === Representation Invariants ===
    - self.op == '+' or self.op == '*' or self.op == '-' or self.op == '\'
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

    def evaluate(self) -> Any:
        """Return the *value* of this expression.

        The returned value should be the result of how this expression would be
        evaluated by the Python interpreter.
        >>> equation = BinOp(Num(1), '+', Num(2))
        >>> equation.evaluate()
        3
        >>> equation = BinOp(Num(1), '*', Num(5/2))
        >>> equation.evaluate()
        5/2
        """
        left = self.left.evaluate()
        right = self.right.evaluate()

        if self.op == '+':
            return left + right

        if self.op == '-':
            return left - right

        if self.op == '/':
            return left / right

        else:
            return left * right

    def __str__(self):
        return f"({self.left.__str__()}) {self.op} ({self.right.__str__()})"

class Power(Expr):
    """A power operation between two expressions.

    === Attributes ===
    left: the left operand
    root: power_sign
    right: the right operand

    === Representation Invariants ===
    - self.root == '^'
    """
    left: Expr
    root: str
    right: Expr

    def __init__(self, left: Expr, right: Expr) -> None:
        """Initialize a new binary operation expression.

        Precondition: <op> is the string '+' or '*'.
        """
        self.left = left
        self.root = '^'
        self.right = right

    def evaluate(self) -> Any:
        """Return the *value* of this power expression.

        The returned value should be the result of how this expression would be
        evaluated by the Python interpreter.
        >>> equation = Power(Num(1), Num(2))
        >>> equation.evaluate()
        1
        >>> equation = Power(Num(2), Num(8))
        >>> equation.evaluate()
        256
        """
        left = self.left.evaluate()
        right = self.right.evaluate()

        return left ** right

    def __str__(self):
        return f"({self.left.__str__()})**({self.right.__str__()})"

class Variable(Expr):
    """
    One of the primary mathematical objects used in proofs.

    ==Public Attributes==
    name: The name/symbol of the variable.
    domain: The domain of the variable, i.e., where the variable comes from
    assignment: What object the variable is assigned to, i.e., int, function, set i.e.,
    """
    name: str
    domain: Union[Set, None]
    assignment: Any
    Properties: list[Any]
    _Sy_var: Symbol

    def __init__(self, name: str) -> None:
        self.assignment = None
        self.name = name
        self.domain = None
        self._Sy_var = Symbol(name)
        self.Properties = []

    def assign(self, value: int) -> None:
        """
        Assigns the value to the variable.
        """
        self.assignment = value
        # TODO check if assignment matches with domain, otherwise, raise an error

    def define_domain(self, domain: Set) -> None:
        self.domain = domain

    def evaluate(self) -> Any:
        """
        Return the value of the variable
        """
        #TODO might want to change this for variables with conditions, i.e., for even numbers, x=2k
        # TODO Might want to make this flexible where the user chooses to plug in values or not

        # Evaluate what the variable is
        if self.assignment is not None:
            return self.assignment

        # Return the name of this variable
        raise ValueError

    def definition(self) -> str:
        """
        Return the definition of the variable.
        """
        # Return the domain and what variable it is equated too
        if (self.assignment is not None) and (self.domain is not None):
            return f"{self.name} ∈ {self.domain}, {self.name} = {self.assignment}"

        # Return the assignment of the variable
        if self.assignment is not None:
            return f"{self.name} = {self.assignment}"

        # Return only the domain
        if self.domain is not None:
            return f"{self.name} ∈ {self.domain}"

        # TODO may want to raise an error here since the variable is undefined
        else:
            return f"Unknown variable: {self.name}"

    def __str__(self):
        return f"{self.assignment}" if self.assignment is not None else f"{self.name}"









