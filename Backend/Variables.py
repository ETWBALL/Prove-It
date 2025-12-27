from __future__ import annotations
from typing import Any, Union
from Sets import Set
from sympy import Symbol, Predicate
from Definition import make_predicate_tree, And


class Variable:
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
    _Sy_var: Symbol

    def __init__(self, name: str, domain: Set) -> None:
        self.name = name
        self.domain = domain
        self.assignment = None
        self._Sy_var = Symbol(name)

    def assign(self, value: Any) -> None:
        """
        Assigns the value to the variable.
        """
        self.assignment = value



def make_variable(expression: str) -> Variable:
    split = expression.split("=")

    # variable is part of a domain
    if len(split) != 2:
        pass

    else:
        var = Variable(split[0], None)
        var.assign(split[1])
        return var



if __name__ == "__main__":
    var = make_variable("x=5")
    print(f"{var.name} = {var.assignment}")
