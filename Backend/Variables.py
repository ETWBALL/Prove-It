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




if __name__ == "__main__":
    condition = make_predicate_tree([['integer'], And, ['positive']])
    Natural_numbers = Set('N', 'n', condition, 'form')

    var = Variable("x", Natural_numbers)
    print(f"{var.name} is in {var.domain.name}")
