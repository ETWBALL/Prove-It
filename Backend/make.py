from propositions import Equation, operators, Proposition, Predicate
from expression import Expr, Num, Variable, BinOp, Power
from typing import Any


def make_equation(eqn: str) -> Equation:
    """
    Given an equation, create a new Equation tree with left and right expressions

    === Preconditions ===
    eqn contains an equal sign with a left and right side
    """
    split = eqn.split("=")
    expr1 = make_expressions(split[0])
    expr2 = make_expressions(split[1])

    #might need a function that evaluates this proposition to true or false
    return Equation(expr1, expr2, True)

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

            if expression[i] in operators or expression[i] == '^':

                # if left exists and the middle operator is not assigned yet
                if left is not None and middle is None:
                    middle = expression[i]



        return BinOp(left, middle, right) if middle != '^' else Power(left, right)

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

def get_truth(obj: Any) -> bool:
    # TODO
    pass

def make_proposition(full_proposition: list) -> Proposition:
    # For now, I have not placed truth values on to these "propositions"
    # Since this is making a proposition tree, there needs to be a way to check if the previous propositions are correct
    if len(full_proposition) == 1:
        truth_value = get_truth(full_proposition[0])
        return Proposition(full_proposition[0], None, None, truth_value)

    else:
        left = make_proposition(full_proposition[0])
        right = make_proposition(full_proposition[2])
        info = left.root + full_proposition[1] + right.root
        return Proposition(info, left, right, None)


def make_predicate_tree(full_proposition: list) -> Predicate:
    # For now, I have not placed truth values on to these "propositions"
    # Since this is making a proposition tree, there needs to be a way to check if the previous propositions are correct
    if len(full_proposition) == 1:
        return Predicate(full_proposition[0], None, None)

    else:
        left = make_predicate_tree(full_proposition[0])
        right = make_predicate_tree(full_proposition[2])
        info = left.root + full_proposition[1] + right.root
        return Predicate(info, left, right)


def update_variable(expr: Expr, user_input: str) -> bool:
        """
        Update the variable of this expression.

        === Preconditions ===
        expression is in the form of <existing_variable> = <new_value>
        """

        # Root could be a variable
        if isinstance(expr, Variable):
            split = user_input.split('=')

            # Root could be another variable value
            if expr.name != split[0]:
                return False
            else:
                if "." in split[1]:
                    expr.assignment = float(split[1])
                else:
                    expr.assignment = int(split[1])
                return True

        # if this root is a binary operator or a power instance
        if isinstance(expr, BinOp) or isinstance(expr, Power):
            left = update_variable(expr.left, user_input)
            right = update_variable(expr.right, user_input)

            return True if left is True or right is True else False

        # This expression is a number
        else:
            return False
