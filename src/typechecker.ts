import { Expr, Stmt, Type } from "./ast"

type ClassEnv = Map<string, [BodyEnv, FunctionsEnv]>
type FunctionsEnv = Map<string, [Type[], Type]>
type BodyEnv = Map<string, Type>

function tcLiteral(e : Expr<any>) : Expr<Type> {
  if(e.tag !== "literal") throw new Error(`TypeError: Expected Literal, got ${e.tag} instead`)
  switch (e.literal) {
    case "True": return { ...e, a: "bool" }
    case "False": return { ...e, a: "bool" }
    case "None": return { ...e, a: "none" }
    default: return { ...e, a: "int" }
  }
}

export function tcExpr(e : Expr<any>, classes : ClassEnv, functions : FunctionsEnv, globals : BodyEnv, locals : BodyEnv) : Expr<Type> {
  switch(e.tag) {
    case "literal":
      return tcLiteral(e)
    case "binexpr":
      var typedleft = tcExpr(e.left, classes, functions, globals, locals)
      var typedright = tcExpr(e.right, classes, functions, globals, locals)
      if ((typedleft.a !== "int" || typedright.a !== "int") && !(e.op === "and" || e.op === "or" || e.op === "is")) {
        throw new Error(`TypeError: Expected both sides to be int for ${e.op}`)
      } 
      if ((typedleft.a !== "bool" || typedright.a !== "bool") && (e.op === "and" || e.op === "or")) {
        throw new Error(`TypeError: Expected both sides to be bool for ${e.op}`)
      } 
      if (e.op === "is") {
        if (typedleft.a === "int" || typedleft.a === "bool" || typedright.a === "int" || typedright.a === "bool") {
          throw new Error(`TypeError: Unsupported operation for is`)
        } 
      } 
      switch(e.op) {
        case "+" : 
          return { ...e, a:"int", left: typedleft, right: typedright }
        case "-": 
          return { ...e, a:"int", left: typedleft, right: typedright }
        case "*": 
          return { ...e, a:"int", left: typedleft, right: typedright }
        case "//": 
          return { ...e, a:"int", left: typedleft, right: typedright }
        case "%": 
          return { ...e, a:"int", left: typedleft, right: typedright }
        case ">": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "<":
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case ">=": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "<=": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "==": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "!=": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "and": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "or": 
          return { ...e, a: "bool", left: typedleft, right: typedright }
        case "is":
          return { ...e, a: "bool", left: typedleft, right: typedright }
        default: throw new Error(`TypeError: Unhandled operator`)
      }
    case "builtin1": 
      const arg = tcExpr(e.arg, classes, functions, globals, locals)
      if (e.name === "print") {
        if (arg.a !== "int" && arg.a !== "bool" && arg.a !== "none") {
          throw new Error(`TypeError: Printing object of class ${arg.a?.class} is not defined`)
        }
        return { ...e, arg, a: "none"}
      }
      else {
        if (arg.a !== "int") {
          throw new Error(`TypeError: Got ${arg.a} as argument, expected int`)
        }
        return { ...e, arg, a: "int"}
      }
    case "builtin2": 
      const arg1 = tcExpr(e.arg1, classes, functions, globals, locals)
      const arg2 = tcExpr(e.arg2, classes, functions, globals, locals)
      if (arg1.a !== "int") throw new Error(`TypeError: Got ${arg1.a} as argument 1, expected int`)
      if (arg2.a !== "int") throw new Error(`TypeError: Got ${arg2.a} as argument 2, expected int`)
      return { ...e, arg1, arg2, a: "int"}
    case "parexpr":
      const tcinner = tcExpr(e.expr, classes, functions, globals, locals)
      return { ...e, expr: tcinner, a: tcinner.a}
    case "uniexpr":
      const tcuni = tcExpr(e.expr, classes, functions, globals, locals)
      if (e.op === "not") {
        if (tcuni.a !== "bool") {
          throw new Error(`TypeError: Expected bool for not, got ${tcuni.a} instead`)
        }
        return { ...e, expr: tcuni, a: "bool"}
      }
      if (tcuni.a !== "int") {
        throw new Error(`TypeError: Expected int for ${e.op}, got ${tcuni.a} instead`)
      }
      return { ...e, expr: tcuni, a: "int"}
    case "id": 
      if (!locals.has(e.name) && !globals.has(e.name)) {
        throw new Error(`TypeError: ${e.name} is not defined`)
      }
      if (locals.has(e.name)) return {...e, a: locals.get(e.name)}
      return {...e, a: globals.get(e.name)}
    case "getfield":
      const tcobj = tcExpr(e.obj, classes, functions, globals, locals)
      if (tcobj.a == "int" || tcobj.a === "bool" || tcobj.a === "none") {
        throw new Error(`TypeError: Cannot get field of type ${tcobj.a}`)
      }
      const c = tcobj.a?.class
      if (c == undefined) throw new Error(`TypeError: Class is undefined`)
      if (classes.get(c) === undefined) {
        throw new Error(`TypeError: No such class as ${c}`)
      }
      const [fields, methods] = classes.get(c)
      if (!fields.has(e.name)) {
        throw new Error(`TypeError: Class ${c} does not have field ${e.name}`)
      }
      return { ...e, obj: tcobj, a: fields.get(e.name)}
    case "call":
      if (e.head.tag === "getfield" ) {
        const tcobj = tcExpr(e.head.obj, classes, functions, globals, locals)
        if (tcobj.a == "int" || tcobj.a === "bool" || tcobj.a === "none") {
          throw new Error(`TypeError: Cannot get method of type ${tcobj.a}`)
        }
        const c = tcobj.a.class
        if (!classes.has(c)) {
          throw new Error(`TypeError: No such class as ${c}`)
        }
        e.head.obj = tcobj
        const [fields, methods] = classes.get(c)
        if (!methods.has(e.head.name)) {
          throw new Error(`TypeError: Class ${c} does not have method ${e.head.name}`)
        }
        const [args, ret] = methods.get(e.head.name)
        if(args.length - 1 !== e.arguments.length) {
          throw new Error(`TypeError: Expected ${args.length - 1} arguments but got ${e.arguments.length} instead`)
        }
        const newargs = args.slice(1).map((a, i) => {
          const argtyp = tcExpr(e.arguments[i], classes, functions, globals, locals)
          if(!assignableTo(argtyp.a, a)) throw new Error(`TypeError: Got ${argtyp.a} as argument ${i + 1}, expected ${a}`)
          return argtyp
        })
        return { ...e, a: ret, arguments: newargs }
      }
      if (e.head.tag === "id") {
        if(functions.has(e.head.name)) {
          const [args, ret] = functions.get(e.head.name)
          if(args.length !== e.arguments.length) {
            throw new Error(`TypeError: Expected ${args.length} arguments but got ${e.arguments.length} instead`)
          }
          const newargs = args.map((a, i) => {
            const argtyp = tcExpr(e.arguments[i], classes, functions, globals, locals)
            if(!assignableTo(argtyp.a, a)) throw new Error(`TypeError: Got ${argtyp.a} as argument ${i + 1}, expected ${a}`)
            return argtyp
          })
          return { ...e, a: ret, arguments: newargs }
        }
        if(classes.has(e.head.name)) {
          return { ...e, a: {tag: "object", class: e.head.name} }
        }
        throw new Error(`TypeError: Function or class ${e.head.name} not found`)
      }
    default: throw new Error(`TypeError: Unsupported type checking for expression ${e.tag}`)
  }
}

function assignableTo(s : Type, t : Type): Boolean {
  if (s === t) return true
  if ((s !== "int" && s !== "bool" && s !== "none") && (t !== "int" && t !== "bool" && t !== "none")) return (s.class === t.class)
  if (s === "none") return (t !== "int" && t !== "bool" && t !== "none")
  return false
}

function checkReturn(stmts : Stmt<any>[]): Boolean {
  let last = stmts.pop()
  stmts.push(last)
  if (last.tag === "return") {
    return true
  }
  else {
    if (last.tag === "if") {
      var thenReturn = checkReturn(last.body)
      var elseReturn = checkReturn(last.elsebody)
      if (thenReturn && elseReturn) {
        return true
      }
      return false
    }
  }
  return false
}

export function tcStmt(s : Stmt<any>, classes : ClassEnv, functions : FunctionsEnv, globals : BodyEnv, locals : BodyEnv, currentReturn : Type): Stmt<Type> {
  switch(s.tag) {
    case "declare":
      s.literal = tcLiteral(s.literal)
      return { ...s, a: "none" }
    case "assign":
      const rhs = tcExpr(s.value, classes, functions, globals, locals)
      s.lhs = tcExpr(s.lhs, classes, functions, globals, locals)
      if ( s.lhs.tag !== "id" && s.lhs.tag !== "getfield" ) {
        throw new Error(`TypeError: Unknown left hand side type ${s.lhs.tag} in AssignStatement`)
      }
      if ( s.lhs.tag === "id" ) { // Error check for simple variable assignment
        if(locals.has(s.lhs.name) && !assignableTo(rhs.a, locals.get(s.lhs.name))) {
          throw new Error(`TypeError: Cannot assign ${rhs.a} to ${locals.get(s.lhs.name)}`)
        }
        else {
          if (!locals.has(s.lhs.name) && locals.keys.length !== 0) {
            throw new Error(`TypeError: Connot assign to variables not explicitly declared in this scope: ${s.lhs.name}`)
          }
          if (globals.has(s.lhs.name) && !assignableTo(rhs.a, globals.get(s.lhs.name))) {
            throw new Error(`TypeError: Cannot assign ${rhs.a} to ${globals.get(s.lhs.name)}`)
          }
        }
      }
      if (s.lhs.tag === "getfield" ) {
        if(!assignableTo(rhs.a, s.lhs.a)) {
          throw new Error(`TypeError: Cannot assign ${rhs.a} to ${s.lhs.a}`)
        }
      }
      return { ...s, a: "none" , value: rhs}
    case "class":
      return { ...s, fields: s.fields.map(f => tcStmt(f, classes, functions, globals, locals, currentReturn)), methods: s.methods.map(m => tcStmt(m, classes, functions, globals, locals, currentReturn)), a: "none" }
    case "define":
      if (s.name === "__init__") {
        if (s.parameters.length > 1) {
          throw new Error(`TypeError: Expected no arguments for __init__ call`)
        }
        if (s.ret !== "none") {
          throw new Error(`TypeError: Expected no return for __init__ call`)
        }
      }
      const vars = tcDecl(s.body)
      s.parameters.forEach(p => { 
        if (vars.has(p.name)) {
          throw new Error(`TypeError: Duplicate declaration of identifier ${p.name} in both parameters and local variables`)
        }  
        vars.set(p.name, p.typ)
      })
      if (s.ret !== "none" && !checkReturn(s.body)) {
        throw new Error(`TypeError: Function must return in all branches`)
      }
      return { ...s, body: s.body.map(bs => tcStmt(bs, classes, functions, globals, vars, s.ret)), a: "none" }
    case "expr":
      const tced = tcExpr(s.expr, classes, functions, globals, locals)
      return {...s, expr: tced, a: tced.a}
    case "return":
      const valTyp = tcExpr(s.value, classes, functions, globals, locals)
      if(!assignableTo(valTyp.a, currentReturn)) {
        throw new Error(`TypeError: ${valTyp.a} returned but ${currentReturn} expected`)
      }
      return {...s, a: "none", value: valTyp}
    case "pass":
      return {...s, a: "none"}
    case "while":
      var tcwhilecond = tcExpr(s.cond, classes, functions, globals, locals)
      if (tcwhilecond.a !== "bool") {
        throw new Error(`TypeError: Expected bool for while condition, got ${tcwhilecond.a} instead`)
      }
      return { ...s, cond: tcwhilecond, body: s.body.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), a: "none" }
    case "if":
      var tcifcond = tcExpr(s.cond, classes, functions, globals, locals)
      if (tcifcond.a !== "bool") {
        throw new Error(`TypeError: Expected bool for if condition, got ${tcifcond.a} instead`)
      }
      if (typeof s.elifcond !== "undefined") {
        var tcelifcond = tcExpr(s.elifcond, classes, functions, globals, locals)
        if (tcelifcond.a !== "bool") {
          throw new Error(`TypeError: Expected bool for elif condition, got ${tcelifcond.a} instead`)
        }
      }
      if (typeof s.elifcond !== "undefined" && typeof s.elsebody !== "undefined") {
        return { ...s, cond: tcifcond, body: s.body.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), elifcond: tcelifcond, elifbody: s.elifbody.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), elsebody: s.elsebody.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), a: "none" }
      }
      else if (typeof s.elifcond !== "undefined") {
        return { ...s, cond: tcifcond, body: s.body.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), elifcond: tcelifcond, elifbody: s.elifbody.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), a: "none" }
      }
      else if (typeof s.elsebody !== "undefined") {
        return { ...s, cond: tcifcond, body: s.body.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), elsebody: s.elsebody.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), a: "none" }
      }
      else {
        return { ...s, cond: tcifcond, body: s.body.map(bs => tcStmt(bs, classes, functions, globals, locals, currentReturn)), a: "none" }
      }
  }
}

function tcDecl(p : Stmt<any>[]): BodyEnv {
  const variables = new Map<string, Type>()
  p.forEach(s => {
    if (s.tag === "declare") {
      if (variables.has(s.var.name)) {
        throw new Error(`TypeError: Duplicate declaration of identifier ${s.var.name}`)
      }
      variables.set(s.var.name, s.var.typ)
      const tcv = tcLiteral(s.literal)
      if (!assignableTo(tcv.a, s.var.typ)) { 
        throw new Error(`TypeError: Cannot assign ${tcv.a} to ${s.var.typ}`)
      }
    }
  })
  return variables
}

function tcFunc(p : Stmt<any>[]): FunctionsEnv {
  const functions = new Map<string, [Type[], Type]>()
  p.forEach(s => {
    if (s.tag === "define") {
      if (functions.has(s.name)) {
        throw new Error(`TypeError: Duplicate definition of function ${s.name}`)  
      }
      functions.set(s.name, [s.parameters.map(p => p.typ), s.ret])
    }
  })
  return functions
}

function tcClass(p : Stmt<any>[]): ClassEnv {
  const classes = new Map<string, [Map<string, Type>, Map<string, [Type[], Type]>]>()
  p.forEach(s => {
    if (s.tag === "class") {
      if (classes.has(s.name)) {
        throw new Error(`TypeError: Duplicate definition of class ${s.name}`)
      }
      const fileds = tcDecl(s.fields)
      const methods = tcFunc(s.methods)
      classes.set(s.name, [fileds, methods])
    }
  })
  return classes
}

export function tcProgram(p : Stmt<any>[]): Stmt<Type>[] {
  const classes = tcClass(p)
  const functions = tcFunc(p)
  const globals = tcDecl(p)
  const locals = new Map<string, Type>()
  return p.map(s => tcStmt(s, classes, functions, globals, locals, "none"))
}