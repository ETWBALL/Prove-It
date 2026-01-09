# rules.py

modus_ponens.apply(p, p_implies_q)
## Given p and p→q, returns q
modus_tollens.apply(not_q, p_implies_q)
## Given ¬q and p→q, returns ¬p
disjunctive_syllogism.apply(p_or_q, not_p)
## Given p∨q and ¬p, returns q
hypothetical_syllogism.apply(p_implies_q, q_implies_r)
## Given p→q and q→r, returns p→r
simplification.apply(p_and_q, get_left=True)
## Given p∧q, returns p (or q if False)
conjunction.apply(p, q)
## Given p and q, returns p∧q
addition.apply(p, "q")
## Given p, returns p∨q
resolution.apply(p_or_q, not_p_or_r)
## Given p∨q and ¬p∨r, returns q∨r


# quantifier_rules.py

universal_instantiation.apply(forall_x_Px, "x", "c")
## Given ∀xP(x), returns P(c)
universal_generalization.apply(Pc, "c", "x", is_arbitrary=True)
## Given P(c) arbitrary, returns ∀xP(x)
existential_instantiation.apply(exists_x_Px, "x", "c")
## Given ∃xP(x), returns P(c) for fresh c
existential_generalization.apply(Pc, "c", "x")
## Given P(c), returns ∃xP(x)
quantifier_negation.apply(not_forall_Px)
## Given ¬∀xP(x), returns ∃x¬P(x)

# proof.py

proof = Proof("conclusion")
## Create proof with target conclusion
proof.add_hypothesis("p → q")
## Add hypothesis, returns line number
proof.apply_modus_ponens(p_line, implication_line)
## Apply rule using line numbers
proof.apply_universal_instantiation(line, "x", "b")
## Instantiate ∀x with constant b
proof.apply_quantifier_negation(line)
## Convert ¬∀x to ∃x¬
proof.print_proof()
## Display formatted proof
proof.is_complete()
## Check if conclusion reached