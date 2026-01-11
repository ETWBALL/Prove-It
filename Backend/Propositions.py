from __future__ import annotations
from typing import Union, Any
from Sets import Set
from sympy import Symbol

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


class Expr:
    """An abstract class representing a Python expression.
    """
    def evaluate(self) -> Any:
        """Return the *value* of this expression.

        The returned value should be the result of how this expression would be
        evaluated by the Python interpreter.
        """
        raise NotImplementedError

    def update_variable(self, expression: str) -> bool:
        """
        Update the variable of this expression.

        === Preconditions ===
        expression is in the form of <existing_variable> = <new_value>
        """

        # Root could be a variable
        if isinstance(self, Variable):
            split = expression.split('=')

            # Root could be another variable value
            if self.name != split[0]:
                return False
            else:
                if "." in split[1]:
                    self.assignment = float(split[1])
                else:
                    self.assignment = int(split[1])
                return True

        # if this root is a binary operator
        if isinstance(self, BinOp):
            left = self.left.update_variable(expression)
            right = self.right.update_variable(expression)

            return True if left is True or right is True else False

        # This expression is a number
        else:
            return False

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

    def __str__(self):
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
        if self.op == '+':
            return self.left.evaluate() + self.right.evaluate()

        if self.op == '-':
            return self.left.evaluate() - self.right.evaluate()

        if self.op == '/':
            return self.left.evaluate() / self.right.evaluate()

        else:
            return self.left.evaluate() * self.right.evaluate()

    def __str__(self):
        return f"({self.left.__str__()}) {self.op} ({self.right.__str__()})"

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
    Properties: list[Proposition]
    _Sy_var: Symbol

    def __init__(self, name: str) -> None:
        self.name = name
        self.domain = None
        self.assignment = None
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

def make_expressions(expression:str) -> Expr:
    """
    Given a string, return an AST numerical object
    === Preconditions ==
    Left operand and right operand must be in brackets
    Numerical values alone must not be in brackets

    === EXAMPLES ===
    >>> e = "1"
    >>> expr = make_expressions(e)
    >>> print(expr)
    1

    >>> e = "(4) + (-5)"
    >>> expr = make_expressions(e)
    >>> print(expr)
    (-4) + (-5)
    """
    if '(' not in expression or ')' not in expression:

        # Check if it is a float
        if '.' in expression:
            return Num(float(expression))

        # Try converting into an int
        try:
            return Num(int(expression))

        # Most likely a variable
        except ValueError:
            return Variable(expression)

    else:
        left_bracket_index, right_bracket_index = None, None
        left, right = None, None
        scope = 0
        middle = None

        for i in range(len(expression)):

            # Locate the first bracket. Keep track of number of brackets
            if expression[i] == '(':
                if scope == 0:
                    left_bracket_index = i
                scope += 1

            # Locate the right bracket. Subtract it,
            if expression[i] == ')':
                scope -= 1
                if scope == 0:
                    right_bracket_index = i

            if scope == 0 and left_bracket_index is not None and right_bracket_index is not None:
                sub_expression = expression[left_bracket_index+1:right_bracket_index]
                left_bracket_index, right_bracket_index = None, None

                if left is None:
                    left = make_expressions(sub_expression)
                else:
                    right = make_expressions(sub_expression)

            if expression[i] in operators:
                if left is not None and middle is None:
                    middle = expression[i]



        return BinOp(left, middle, right)

def make_variable(expression: str):
    split = expression.split("=")

    # variable is part of a "known" domain #TODO make this condition

    # In the case where a user defined the variable to nothing
    if len(split) != 2:
        return Variable(split[0])

    # If the variable is assigned to a value, assign
    else:
        var = Variable(split[0])
        var.assign(int(split[1]))
        return var








