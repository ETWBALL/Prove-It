from Propositions import BinOp, Num, make_expressions, Variable, make_variable

def test_bin_op_print_four_signs() -> None:
    assert BinOp(Num(1), '+', Num(2)).__str__() == '(1) + (2)'
    assert BinOp(Num(-1), '+', Num(2)).__str__() == '(-1) + (2)'
    assert BinOp(Num(1), '+', Num(-2)).__str__() == '(1) + (-2)'
    assert BinOp(Num(-1), '+', Num(-2)).__str__() == '(-1) + (-2)'


def test_make_expr_trees_unary_sign()-> None:
    expr = make_expressions('1')
    assert expr.__str__() == '1'

    expr = make_expressions("-1")
    assert expr.__str__() == '-1'

    expr = make_expressions("+9")
    assert expr.__str__() == '9'

    expr = make_expressions("0")
    assert expr.__str__() == '0'

    expr = make_expressions("13")
    assert expr.__str__() == '13'

    expr = make_expressions("+67")
    assert expr.__str__() == '67'

    expr = make_expressions("-55")
    assert expr.__str__() == '-55'

    expr = make_expressions("000")
    assert expr.__str__() == '0'

def test_make_expr_trees() -> None:

    expr = make_expressions("593493")
    assert expr.__str__() == '593493'

    expr = make_expressions("+6349823242")
    assert expr.__str__() == '6349823242'

    expr = make_expressions("-33423563")
    assert expr.__str__() == '-33423563'

    expr = make_expressions("(1) + (2)")
    assert expr.__str__() == '(1) + (2)' # 1 + 2

    expr = make_expressions("((1)+(2)) + (3)")
    assert expr.__str__() == '((1) + (2)) + (3)'

    expr = make_expressions("(-1) + (-55)")
    assert expr.__str__() == '(-1) + (-55)'

def test_make_expr_trees_white_space_robustness() -> None:
    expr = make_expressions("( 1 ) + ( 2 )")
    assert expr.__str__() == '(1) + (2)'

    expr = make_expressions("( -3 )    *    ( 4 )")
    assert expr.__str__() == '(-3) * (4)'

def test_make_expr_trees_varying_sizes()-> None:
    expr = make_expressions("(-12) + (0.5)")
    assert expr.evaluate() == -11.5
    assert expr.__str__() == '(-12) + (0.5)'

    expr = make_expressions("((345) * (-2)) + (7.1)")
    assert expr.__str__() == '((345) * (-2)) + (7.1)'
    assert expr.evaluate() == -682.9

    expr = make_expressions("(0.003) + ((-78) * (6))")
    assert expr.__str__() == '(0.003) + ((-78) * (6))'
    assert expr.evaluate() == -467.997

    expr = make_expressions("((-999) + (42)) + ((7) + (-0.25))")
    assert expr.__str__() == '((-999) + (42)) + ((7) + (-0.25))'
    assert expr.evaluate() == -950.25

    expr = make_expressions("((123456) * (-0.5)) + ((-3) + (0.1))")
    assert expr.__str__() == '((123456) * (-0.5)) + ((-3) + (0.1))'
    assert expr.evaluate() == -61730.9

    expr = make_expressions("((0.1) + ((-23) * (456))) * ((7) + (0.07))")
    assert expr.__str__() == '((0.1) + ((-23) * (456))) * ((7) + (0.07))'
    assert expr.evaluate() == -74149.453

    expr = make_expressions("((-0.5) + ((100) * (-2))) + ((0.3) * (-7))")
    assert expr.__str__() == '((-0.5) + ((100) * (-2))) + ((0.3) * (-7))'
    assert expr.evaluate() == -202.6

    expr = make_expressions("(((12) + (-0.01)) * ((-8) + (90))) + ((0.001) + (-3))")
    assert expr.__str__() == '(((12) + (-0.01)) * ((-8) + (90))) + ((0.001) + (-3))'
    assert expr.evaluate() == 980.181

    expr = make_expressions("((345) + ((-0.7) * (9))) * ((-12) + (0.12))")
    assert expr.__str__() == '((345) + ((-0.7) * (9))) * ((-12) + (0.12))'

    expr = make_expressions("((0.5) * ((-1000) + (3))) + (((-2) * (7.7)) + (42))")
    assert expr.__str__() == '((0.5) * ((-1000) + (3))) + (((-2) * (7.7)) + (42))'
    assert expr.evaluate() == -471.9

def test_make_expr_divisions_and_subtractions() -> None:
    expr = make_expressions("(-12) - (0.5)")
    assert expr.__str__() == '(-12) - (0.5)'
    assert expr.evaluate() == -12.5

    expr = make_expressions("((345) / (-2)) - (7.1)")
    assert expr.__str__() == '((345) / (-2)) - (7.1)'
    assert expr.evaluate() == -179.6

    expr = make_expressions("(0.003) - ((-78) / (6))")
    assert expr.__str__() == '(0.003) - ((-78) / (6))'
    assert expr.evaluate() == 13.003

    expr = make_expressions("((-999) - (42)) - ((7) - (-0.25))")
    assert expr.__str__() == '((-999) - (42)) - ((7) - (-0.25))'
    assert expr.evaluate() == -1048.25

    expr = make_expressions("((123456) / (-0.5)) - ((-3) - (0.1))")
    assert expr.__str__() == '((123456) / (-0.5)) - ((-3) - (0.1))'
    assert expr.evaluate() == -246908.9

    expr = make_expressions("((0.1) - ((-23) / (10))) - ((7) - (0.07))")
    assert expr.__str__() == '((0.1) - ((-23) / (10))) - ((7) - (0.07))'
    assert expr.evaluate() == -4.529999999999999

    expr = make_expressions("((-0.5) - ((100) / (-2))) - ((0.3) / (-7))")
    assert expr.__str__() == '((-0.5) - ((100) / (-2))) - ((0.3) / (-7))'
    assert expr.evaluate() == 49.542857142857144

    expr = make_expressions("(((12) - (-0.01)) / ((-8) - (90))) - ((0.001) - (-3))")
    assert expr.__str__() == '(((12) - (-0.01)) / ((-8) - (90))) - ((0.001) - (-3))'
    assert expr.evaluate() == -3.123551020408163

    expr = make_expressions("((345) - ((-0.7) / (9))) - ((-12) - (0.12))")
    assert expr.__str__() == '((345) - ((-0.7) / (9))) - ((-12) - (0.12))'
    assert expr.evaluate() == 357.1977777777778

    expr = make_expressions("((0.5) / ((-1000) - (3))) - (((-2) / (7.7)) - (42))")
    assert expr.__str__() == '((0.5) / ((-1000) - (3))) - (((-2) / (7.7)) - (42))'
    assert expr.evaluate() == 42.25924175525372

def test_variables_initialization_assignment():
    x = Variable('x')
    x.assign(3)
    assert x.assignment == 3   #x=3

    x.assign(-3)
    assert x.assignment == -3   #x=-3

    x.assign(0)
    assert x.assignment == 0    #x=0


def test_make_variable():
    x = make_variable('x') #TODO must be initialized
    assert x.definition() == 'Unknown variable: x'

    y = make_variable('y=4')
    assert y.assignment == 4 #y=4

    z = make_variable('z=-334')
    assert z.assignment == -334 #z=-334

def test_variable_prints_assignments():
    x = make_variable('x=5')
    assert x.__str__() == '5'

    x = make_variable('x=-6')
    assert x.__str__() == '-6'

    x = make_variable('x')
    assert x.__str__() == 'x'

def test_make_variable_expressions():
    expr = make_expressions("(a) + (0.5)")
    assert expr.__str__() == '(a) + (0.5)'

    expr = make_expressions("(a) - (0.5)")
    assert expr.__str__() == '(a) - (0.5)'

    expr = make_expressions("((a) + (b)) / (c)")
    assert expr.__str__() == "((a) + (b)) / (c)"

def test_update_variable_in_expression():
    expr = make_expressions("(a) + (0.5)")
    expr.update_variable('a=2')
    assert expr.evaluate() == 2.5

    expr = make_expressions("((a) + (b)) / (c)")
    expr.update_variable('a=2')
    assert expr.__str__() == "((2) + (b)) / (c)"
    expr.update_variable('a=3')
    assert expr.__str__() == "((3) + (b)) / (c)"
    expr.update_variable('b=31')
    assert expr.__str__() == "((3) + (31)) / (c)"
    expr.update_variable('b=5')
    assert expr.__str__() == "((3) + (5)) / (c)"
    expr.update_variable('c=2')
    assert expr.evaluate() == 4






if __name__ == '__main__':
    import pytest
    pytest.main(['test_propositions.py'])