from Propositions import BinOp, Num, make_numerical_expression

def test_bin_op_print_four_signs() -> None:
    assert BinOp(Num(1), '+', Num(2)).__str__() == '(1) + (2)'
    assert BinOp(Num(-1), '+', Num(2)).__str__() == '(-1) + (2)'
    assert BinOp(Num(1), '+', Num(-2)).__str__() == '(1) + (-2)'
    assert BinOp(Num(-1), '+', Num(-2)).__str__() == '(-1) + (-2)'

def test_bin_op_print_varying_expression_sizes() -> None:

    pass

def test_make_expr_trees_unary_sign()-> None:
    expr = make_numerical_expression('1')
    assert expr.__str__() == '1'

    expr = make_numerical_expression("-1")
    assert expr.__str__() == '-1'

    expr = make_numerical_expression("+9")
    assert expr.__str__() == '9'

    expr = make_numerical_expression("0")
    assert expr.__str__() == '0'

    expr = make_numerical_expression("13")
    assert expr.__str__() == '13'

    expr = make_numerical_expression("+67")
    assert expr.__str__() == '67'

    expr = make_numerical_expression("-55")
    assert expr.__str__() == '-55'

    expr = make_numerical_expression("000")
    assert expr.__str__() == '0'

def test_make_expr_trees() -> None:

    expr = make_numerical_expression("593493")
    assert expr.__str__() == '593493'

    expr = make_numerical_expression("+6349823242")
    assert expr.__str__() == '6349823242'

    expr = make_numerical_expression("-33423563")
    assert expr.__str__() == '-33423563'

    expr = make_numerical_expression("(1) + (2)")
    assert expr.__str__() == '(1) + (2)' # 1 + 2

    expr = make_numerical_expression("((1)+(2)) + (3)")
    assert expr.__str__() == '((1) + (2)) + (3)'

    expr = make_numerical_expression("(-1) + (-55)")
    assert expr.__str__() == '(-1) + (-55)'

def test_make_expr_trees_white_space_robustness() -> None:
    expr = make_numerical_expression("( 1 ) + ( 2 )")
    assert expr.__str__() == '(1) + (2)'

    expr = make_numerical_expression("( -3 )    *    ( 4 )")
    assert expr.__str__() == '(-3) * (4)'

def test_make_expr_trees_varying_sizes()-> None:
    expr = make_numerical_expression("(-12) + (0.5)")
    assert expr.__str__() == '(-12) + (0.5)'

    expr = make_numerical_expression("((345) * (-2)) + (7.1)")
    assert expr.__str__() == '((345) * (-2)) + (7.1)'

    expr = make_numerical_expression("(0.003) + ((-78) * (6))")
    assert expr.__str__() == '(0.003) + ((-78) * (6))'

    expr = make_numerical_expression("((-999) + (42)) + ((7) + (-0.25))")
    assert expr.__str__() == '((-999) + (42)) + ((7) + (-0.25))'

    expr = make_numerical_expression("((123456) * (-0.5)) + ((-3) + (0.1))")
    assert expr.__str__() == '((123456) * (-0.5)) + ((-3) + (0.1))'

    expr = make_numerical_expression("((0.1) + ((-23) * (456))) * ((7) + (0.07))")
    assert expr.__str__() == '((0.1) + ((-23) * (456))) * ((7) + (0.07))'

    expr = make_numerical_expression("((-0.5) + ((100) * (-2))) + ((0.3) * (-7))")
    assert expr.__str__() == '((-0.5) + ((100) * (-2))) + ((0.3) * (-7))'

    expr = make_numerical_expression("(((12) + (-0.01)) * ((-8) + (90))) + ((0.001) + (-3))")
    assert expr.__str__() == '(((12) + (-0.01)) * ((-8) + (90))) + ((0.001) + (-3))'

    expr = make_numerical_expression("((345) + ((-0.7) * (9))) * ((-12) + (0.12))")
    assert expr.__str__() == '((345) + ((-0.7) * (9))) * ((-12) + (0.12))'

    expr = make_numerical_expression("((0.5) * ((-1000) + (3))) + (((-2) * (7.7)) + (42))")
    assert expr.__str__() == '((0.5) * ((-1000) + (3))) + (((-2) * (7.7)) + (42))'


if __name__ == '__main__':
    import pytest
    pytest.main(['test_propositions.py'])