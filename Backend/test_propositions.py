from Propositions import BinOp, Num, make_numerical_expression

def test_bin_op_print_four_signs() -> None:
    assert BinOp(Num(1), '+', Num(2)).__str__() == '(1) + (2)'
    assert BinOp(Num(-1), '+', Num(2)).__str__() == '(-1) + (2)'
    assert BinOp(Num(1), '+', Num(-2)).__str__() == '(1) + (-2)'
    assert BinOp(Num(-1), '+', Num(-2)).__str__() == '(-1) + (-2)'

def test_bin_op_print_varying_expression_sizes() -> None:

    pass

def test_make_expr_trees()-> None:
    expr = make_numerical_expression('1')
    assert expr.__str__() == '1'

    expr = make_numerical_expression("(1) + (2)")
    assert expr.__str__() == '(1) + (2)' # 1 + 2

    expr = make_numerical_expression("((1)+(2)) + (3)")
    assert expr.__str__() == '((1) + (2)) + (3)'

    expr = make_numerical_expression("-1")
    assert expr.__str__() == '-1'

    expr = make_numerical_expression("-55")
    assert expr.__str__() == '-55'

    expr = make_numerical_expression("(-1) + (-55)")
    assert expr.__str__() == '(-1) + (-55)'

if __name__ == '__main__':
    import pytest
    pytest.main(['test_propositions.py'])