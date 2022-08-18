import { TreeCursor } from '@lezer/common'
import { parser } from '@lezer/python'
import { Parameter, Stmt, Expr, Type, isOp } from './ast'

export function parseProgram(source : string) : Array<Stmt<Type>> {
  const t = parser.parse(source).cursor()
  return traverseStmts(source, t)
}

export function traverseStmts(s : string, t : TreeCursor) {
  // The top node in the program is a Script node
  t.firstChild()
  const stmts = []
  do {
    stmts.push(traverseStmt(s, t))
  } while(t.nextSibling())
  return stmts
}

export function traverseStmt(s : string, t : TreeCursor) : Stmt<Type> {
  switch(t.type.name) {
    case "IfStatement":
      var haselif : boolean = false
      var haselse : boolean = false
      var elifcond : Expr<Type> = { tag: "id", name: "placeholer" }
      t.firstChild()  // if
      t.nextSibling() // cond
      var cond = traverseExpr(s, t)
      t.nextSibling() // Focus on Body
      t.firstChild()  // Focus on :
      var ifbody = []
      while(t.nextSibling()) {
        ifbody.push(traverseStmt(s, t))
      }
      t.parent()  // Pop to Body
      while (t.nextSibling()) { // deal with elif
        if (t.node.type.name === "elif") {
          t.nextSibling()
          var elifcond = traverseExpr(s, t)
          t.nextSibling() // Focus on Body
          t.firstChild()  // Focus on :
          var elifbody = []
          while(t.nextSibling()) {
            elifbody.push(traverseStmt(s, t))
          }
          t.parent()  // Pop to Body
          haselif = true
        }
        else if (t.node.type.name === "else") {
          t.nextSibling() // Focus on Body
          t.firstChild()  // Focus on :
          var elsebody = []
          while(t.nextSibling()) {
            elsebody.push(traverseStmt(s, t))
          }
          t.parent()  // Pop to Body
          haselse = true
        }
      }
      t.parent()
      if (haselif && haselse) {
        return { tag: "if", cond: cond, body: ifbody, elifcond: elifcond, elifbody: elifbody, elsebody: elsebody }
      }
      else if (haselif) {
        return { tag: "if", cond: cond, body: ifbody, elifcond: elifcond, elifbody: elifbody }
      }
      else if (haselse) {
        return { tag: "if", cond: cond, body: ifbody, elsebody: elsebody }
      }
      else {
        return { tag: "if", cond: cond, body: ifbody }
      }
    case "WhileStatement":
      t.firstChild()
      t.nextSibling()
      var cond = traverseExpr(s, t)
      t.nextSibling() // Focus on Body
      t.firstChild()  // Focus on :
      var whilebody = []
      while(t.nextSibling()) {
        whilebody.push(traverseStmt(s, t))
      }
      t.parent()      // Pop to Body
      t.parent()
      return { tag: "while", cond, body: whilebody }
    case "PassStatement":
      return { tag: "pass" }
    case "ReturnStatement":
      t.firstChild()  // Focus return keyword
      if (t.nextSibling()) {
        var value = traverseExpr(s, t)
        t.parent()
        return { tag: "return", value }
      } // Focus expression
      t.parent()
      return { tag: "return", value: { tag: "literal", literal: "None"} }
    case "AssignStatement":
      t.firstChild() // focused on lhs (the first child)
      var lhs = traverseExpr(s, t)
      var name = s.substring(t.from, t.to)
      t.nextSibling() // focused on = sign. May need this for complex tasks, like +=
      if (t.node.type.name === "AssignOp") {
        t.nextSibling() // focused on the value expression
        var value = traverseExpr(s, t)
        t.parent()
        return { tag: "assign", lhs, value }
      }
      else { // declaration
        t.firstChild()
        t.nextSibling()
        var typ = traverseType(s, t)
        t.parent()
        t.nextSibling()  // Focus on AssignOp
        t.nextSibling()  // Focus on rhs
        var value = traverseExpr(s, t)
        if (value.tag !== "literal") throw new Error(`ParseError: Declared variable's value expression type ${value.tag} is not literal`)
        t.parent()
        return { tag: "declare", var: {name, typ: typ}, literal: value }
      }
    case "ExpressionStatement":
      t.firstChild() // The child is some kind of expression, the
                     // ExpressionStatement is just a wrapper with no information
      var expr = traverseExpr(s, t)
      t.parent()
      return { tag: "expr", expr: expr }
    case "ClassDefinition":
      t.firstChild()  // Focus on class
      t.nextSibling() // Focus on name of class
      var name = s.substring(t.from, t.to)
      t.nextSibling() // Focus on ArgList
      t.nextSibling() // Focus on Body
      t.firstChild()  // Focus on :
      const fields = []
      const methods = []
      while(t.nextSibling()) {
        var stmt = traverseStmt(s, t)
        if (stmt.tag === "declare") {
          fields.push(stmt)
        }
        if (stmt.tag === "define") {
          methods.push(stmt)
        }
      }
      t.parent()     // Pop to Body
      t.parent()     // Pop to ClassDefinition
      return { tag: "class", name, fields, methods}
    case "FunctionDefinition":
      t.firstChild()  // Focus on def
      t.nextSibling() // Focus on name of function
      var name = s.substring(t.from, t.to)
      t.nextSibling() // Focus on ParamList
      var parameters = traverseParameters(s, t)
      t.nextSibling() // Focus on Body or TypeDef
      let ret : Type = "none"
      let maybeTD = t
      if(maybeTD.type.name === "TypeDef") {
        t.firstChild()
        ret = traverseType(s, t)
        t.parent()
        t.nextSibling()
      }
      t.firstChild()  // Focus on :
      const body = []
      while(t.nextSibling()) {
        body.push(traverseStmt(s, t))
      }
      t.parent()      // Pop to Body
      t.parent()      // Pop to FunctionDefinition
      return { tag: "define", name, parameters, body, ret }
    default:
      throw new Error(`ParseError: Unsupported python statement type: ${t.type.name}`)
  }
}

export function traverseType(s : string, t : TreeCursor) : Type {
  switch(t.type.name) {
    case "VariableName":
      const name = s.substring(t.from, t.to)
      if(name !== "int" && name !== "bool") {
        return { tag: "object", class: name }
      }
      return name
    default:
      throw new Error(`ParseError: Unknown type ${t.type.name}`)

  }
}

export function traverseParameters(s : string, t : TreeCursor) : Array<Parameter> {
  t.firstChild()  // Focuses on open paren
  const parameters = []
  t.nextSibling() // Focuses on a VariableName
  while(t.type.name !== ")") {
    let name = s.substring(t.from, t.to)
    t.nextSibling() // Focuses on "TypeDef"
    let nextTagName = t.type.name
    if(nextTagName !== "TypeDef") throw new Error(`ParseError: Missed type annotation for parameter ${name}`)
    t.firstChild()  // Enter TypeDef
    t.nextSibling() // Focuses on type itself
    let typ = traverseType(s, t)
    t.parent()
    t.nextSibling() // Move on to comma or ")"
    parameters.push({name, typ})
    t.nextSibling() // Focuses on a VariableName
  }
  t.parent()       // Pop to ParamList
  return parameters
}

export function traverseExpr(s : string, t : TreeCursor) : Expr<Type> {
  switch(t.type.name) {
    case "None":
      return { tag: "literal", literal: "None" }
    case "Number":
      return { tag: "literal", literal: Number(s.substring(t.from, t.to)) }
    case "Boolean":
      switch (s.substring(t.from, t.to)) {
        case ("True"):
          return { tag: "literal", literal: "True" }
        case ("False"):
          return { tag: "literal", literal: "False"}
        default: throw new Error(`ParseError: Unrecognized bool type ${s.substring(t.from, t.to)}`)
      }
    case "VariableName":
      return { tag: "id", name: s.substring(t.from, t.to) }
    case "MemberExpression":
      t.firstChild()  // Focus on VariableName
      var obj = traverseExpr(s, t)
      t.nextSibling() // Focus on :
      t.nextSibling() // Focus on PropertyName
      var name = s.substring(t.from, t.to)
      t.parent()
      return { tag: "getfield", obj, name }
    case "CallExpression":
      t.firstChild() // Focus name
      var head = traverseExpr(s, t)
      var callName = s.substring(t.from, t.to)
      t.nextSibling() // Focus ArgList
      t.firstChild()  // Focus open paren
      var args = traverseArguments(t, s)
      t.parent()
      if (callName === "print" || callName === "abs") {
        if (args.length !== 1) throw new Error(`ParseError: ${callName} accepts only 1 argument`)
        return { tag: "builtin1", name: callName, arg: args[0] }
      }
      if (callName === "max" || callName === "min" || callName === "pow") {
        if (args.length !== 2) throw new Error(`ParseError: ${callName} accepts only 2 arguments`)
        return { tag: "builtin2", name: callName, arg1: args[0], arg2: args[1] }
      }
      return { tag: "call", head, arguments: args }
    case "UnaryExpression":
      const val = Number(s.substring(t.from, t.to))
      if (!isNaN(val)) return { tag: "literal", literal: val }
      t.firstChild()
      const unaryop = s.substring(t.from, t.to)
      if (unaryop != "+" && unaryop != "-" && unaryop != "not") throw new Error(`ParseError: Unsupported unary operator ${unaryop}`)
      t.nextSibling()
      var uniexpr = traverseExpr(s, t)
      t.parent()
      return { tag: "uniexpr", expr: uniexpr, op: unaryop }
    case "BinaryExpression":
      t.firstChild()
      const left = traverseExpr(s, t)
      t.nextSibling()
      const op = s.substring(t.from, t.to)
      if (!isOp(op)) throw new Error(`ParseError: Unsupported binary operator ${op}`)
      t.nextSibling()
      const right = traverseExpr(s, t)
      t.parent()
      return { tag: "binexpr", left, op, right }
    case "ParenthesizedExpression":
      t.firstChild()
      t.nextSibling()
      var inner = traverseExpr(s, t)
      t.parent()
      return { tag:"parexpr", expr: inner }
    default: throw new Error(`ParseError: Unrecognized expression type ${t.type.name}`)
  }
}

export function traverseArguments(c : TreeCursor, s : string) : Expr<Type>[] {
  c.firstChild()   // Focuses on open paren
  const args = []
  c.nextSibling()
  while(c.type.name !== ")") {
    let expr = traverseExpr(s, c)
    args.push(expr)
    c.nextSibling() // Focuses on either "," or ")"
    c.nextSibling() // Focuses on a VariableName
  } 
  c.parent()        // Pop to ArgList
  return args
}