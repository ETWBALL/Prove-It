from Propositions import Equation, operators
from Expression import Expr, Num, Variable, BinOp, Power



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
