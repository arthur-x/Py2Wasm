export type Type =
  | "int"
  | "bool"
  | "none"
  | { tag: "object", class: string }

export type Literal = 
  | "None"
  | "True"
  | "False"
  | number

export type Parameter =
  | { name: string, typ: Type }

export type Stmt<A> =
  | { a?: A, tag: "class", name: string, fields: Array<Stmt<A>>, methods: Array<Stmt<A>> }
  | { a?: A, tag: "declare", var: Parameter, literal: Expr<A> }
  | { a?: A, tag: "assign", lhs: Expr<A>, value: Expr<A> }
  | { a?: A, tag: "expr", expr: Expr<A> }
  | { a?: A, tag: "define", name: string, parameters: Array<Parameter>, ret: Type, body: Array<Stmt<A>> }
  | { a?: A, tag: "if", cond: Expr<A>, body: Array<Stmt<A>>, elifcond?: Expr<A>, elifbody?: Array<Stmt<A>>, elsebody?: Array<Stmt<A>> }
  | { a?: A, tag: "while", cond: Expr<A>, body: Array<Stmt<A>> }
  | { a?: A, tag: "pass" }
  | { a?: A, tag: "return", value: Expr<A> }

export type Expr<A> = 
  | { a?: A, tag: "getfield", obj: Expr<A>, name: string }
  | { a?: A, tag: "literal", literal: Literal }
  | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "call", head: Expr<A>, arguments: Array<Expr<A>> }
  | { a?: A, tag: "builtin1", name: string, arg: Expr<A> }
  | { a?: A, tag: "builtin2", name: string, arg1: Expr<A>, arg2: Expr<A> }
  | { a?: A, tag: "uniexpr", op: string, expr: Expr<A> }
  | { a?: A, tag: "binexpr", left: Expr<A>, op: Op, right: Expr<A> }
  | { a?: A, tag: "parexpr", expr: Expr<A> }

const ops = {"+": true, "-": true, "*": true, "//": true, "%": true,
 "==": true, "!=": true, "<=": true, ">=": true,
 ">": true, "<": true, "and": true, "or": true, "is": true}
export type Op = keyof (typeof ops)
export function isOp(maybeOp : string) : maybeOp is Op {
  return maybeOp in ops
}