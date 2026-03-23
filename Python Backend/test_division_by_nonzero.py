def test_unknown_variable():
    eqn1 = "a**2 = b**2"
    eqn2 = "a = (b**2)/a"

    with pytest.raises(NameError, match="Unknown variable: a, b"):
        division_by_nonzero(eqn1, eqn2)




if __name__ == '__main__':
    import pytest
    pytest.main(['test_division_by_nonzero.py'])