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

operators = ['+', '*']

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

    def __str__(self):
        return f"{self.n}"

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
        else:
            return self.left.evaluate() * self.right.evaluate()

    def __str__(self):
        return f"({self.left.__str__()}) {self.op} ({self.right.__str__()})"


def make_numerical_expression(expression:str) -> Expr:
    """
    Given a string, return an AST numerical object
    === Preconditions ==
    Left operand and right operand must be in brackets
    Numerical values alone must not be in brackets

    === EXAMPLES ===
    >>> e = "1"
    >>> expr = make_numerical_expression(e)
    >>> print(expr)
    1

    >>> e = "(4) + (-5)"
    >>> expr = make_numerical_expression(e)
    >>> print(expr)
    (-4) + (-5)
    """
    if '(' not in expression or ')' not in expression:
        if '.' in expression:
            return Num(float(expression))
        else:
            return Num(int(expression))
    else:
        left_bracket_index, right_bracket_index = None, None
        left, right = None, None
        middle_i = None
        scope = 0

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

            if scope == 0:
                sub_expression = expression[left_bracket_index+1:right_bracket_index]

                if left is None:
                    left = make_numerical_expression(sub_expression)
                else:
                    right = make_numerical_expression(sub_expression)

            if expression[i] in operators:
                middle_i = i



        return BinOp(left, expression[middle_i], right)






