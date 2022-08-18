import wabt from 'wabt'
import { Stmt, Expr, Type, Op } from './ast'
import { parseProgram } from './parser'
import { tcProgram } from './tc'

type Env = Map<string, boolean>
type ClassEnv = Map<string, [Stmt<Type>[], Stmt<Type>[]]>

function variableNames(stmts: Stmt<Type>[]) : string[] {
  const vars : Array<string> = []
  stmts.forEach((stmt) => {
    if(stmt.tag === "declare") { vars.push(stmt.var.name) }
  })
  return vars
}
function funs(stmts: Stmt<Type>[]) : Stmt<Type>[] {
  return stmts.filter(stmt => stmt.tag === "define")
}
function classes(stmts : Stmt<Type>[]) : ClassEnv {
  const classes = new Map<string, [Stmt<Type>[], Stmt<Type>[]]>()
  stmts.forEach(stmt => {
    if(stmt.tag === "class") {
      classes.set(stmt.name, [stmt.fields, stmt.methods])
    }
  })
  return classes
}
function nonFuns(stmts: Stmt<Type>[]) : Stmt<Type>[] {
  return stmts.filter(stmt => stmt.tag !== "define" && stmt.tag !== "class")
}
function varsClassesFunsStmts(stmts: Stmt<Type>[]) : [string[], ClassEnv, Stmt<Type>[], Stmt<Type>[]] {
  return [variableNames(stmts), classes(stmts), funs(stmts), nonFuns(stmts)]
}

export function opStmts(op : Op) {
  switch(op) {
    case "+": return [`(i32.add)`]
    case "-": return [`(i32.sub)`]
    case "*": return [`(i32.mul)`]
    case "//": return [`(i32.div_s)`]
    case "%": return [`(i32.rem_s)`]
    case ">": return [`(i32.gt_s)`]
    case "<": return [`(i32.lt_s)`]
    case ">=": return [`(i32.ge_s)`]
    case "<=": return [`(i32.le_s)`]
    case "==": return [`(i32.eq)`]
    case "!=": return [`(i32.ne)`]
    case "and": return [`(i32.and)`]
    case "or": return [`(i32.or)`]
    case "is": return [`(i32.eq)`]
    default:
      throw new Error(`CompileError: Unhandled operator ${op}`)
  }
}

function codeGenLiteral(expr : Expr<Type>) : string {
  if(expr.tag !== "literal") {
    throw new Error(`CompileError: Expected literal, got ${expr.tag} instead`)
  }
  switch (expr.literal) { 
    case "True":
      return `(i32.const 1)`
    case "False":
      return `(i32.const 0)`
    case "None":
      return `(i32.const -1)`
    default:
      return `(i32.const ${expr.literal})`
  }
}

export function codeGenExpr(expr : Expr<Type>, locals: Env, classes: ClassEnv) : Array<string> {
  switch(expr.tag) {
    case "id": 
      if(locals.has(expr.name)) { return [`(local.get $${expr.name})`] }
      else { return [`(global.get $${expr.name})`] }
    case "literal":
      return [codeGenLiteral(expr)]
    case "builtin1":
      const argStmts = codeGenExpr(expr.arg, locals, classes)
      let toCall = expr.name
      if (expr.name === "print") {
        switch (expr.arg.a) {
          case "bool": toCall = "print_bool"; break
          case "int": toCall = "print_num"; break
          case "none": toCall = "print_none"; break
          default: throw new Error(`CompileError: Unrecognized type ${expr.arg.a} for print`)
        }
      }
      return argStmts.concat([`(call $${toCall})`])
    case "builtin2":
      const argexpr1 = codeGenExpr(expr.arg1, locals, classes)
      const argexpr2 = codeGenExpr(expr.arg2, locals, classes)
      return argexpr1.concat(argexpr2, [`(call $${expr.name})`])
    case "binexpr":
      const leftexprs = codeGenExpr(expr.left, locals, classes)
      const rightexprs = codeGenExpr(expr.right, locals, classes)
      const opstmts = opStmts(expr.op)
      return leftexprs.concat(rightexprs, opstmts)
    case "call":
      if (expr.head.tag === "id") {
        if (!classes.has(expr.head.name)) {
          const valStmts = expr.arguments.map(e => codeGenExpr(e, locals, classes)).flat()
          valStmts.push(`(call $${expr.head.name})`)
          return valStmts
        }
        else {
          let initvals : string[] = []
          const classname = expr.head.name
          const [fileds, methods] = classes.get(classname)
          var hasinit : boolean = false
          methods.forEach(m => {
            if (m.tag === "define") {
              if (m.name === classname+"$__init__") {
                hasinit = true
              }
            }
          })
          fileds.forEach((f, index) => {
            if (f.tag !== "declare") {
              throw new Error(`CompileError: Expected declare in init, got ${f.tag} instead`)
            }
            const offset = 4
            initvals = [
              ...initvals,
              `(global.get $heap)`,
              `(i32.add (i32.const ${offset*index}))`,
              codeGenLiteral(f.literal),
              `i32.store`
            ]
          })
          if (hasinit) {
            return [
              ...initvals,
              `(global.get $heap)`,
              `(global.set $heap (i32.add (global.get $heap) (i32.const ${fileds.length*4})))`,
              `(call $${classname+"$__init__"})`
            ]
          }
          return [
            ...initvals,
            `(global.get $heap)`,
            `(global.set $heap (i32.add (global.get $heap) (i32.const ${fileds.length*4})))`
          ]
        }
      }
      if (expr.head.tag !== "getfield") {
        throw new Error(`CompileError: Expected getfiled for method call, got ${expr.head.tag} instead`)
      }
      const valStmts = [expr.head.obj, ...expr.arguments].map(e => codeGenExpr(e, locals, classes)).flat()
      if (!(expr.head.obj.a !== "int" && expr.head.obj.a !== "bool" && expr.head.obj.a !== "none")) {
        throw new Error(`CompileError: Expected object type for method call, got ${expr.head.obj.a} instead`)
      }
      const classname = expr.head.obj.a.class
      valStmts.push(`(call $${classname+"$"+expr.head.name})`)
      return valStmts
    case "getfield":
      const objStmts = codeGenExpr(expr.obj, locals, classes)
      if (!(expr.obj.a !== "int" && expr.obj.a !== "bool" && expr.obj.a !== "none")) {
        throw new Error(`CompileError: Expected object type for getfield, got ${expr.obj.a} instead`)
      }
      const fileds = classes.get(expr.obj.a.class)[0]
      var indexOfField : number = 0
      fileds.forEach((f, index) => {
        if (f.tag === "declare") {
          if (f.var.name === expr.name) {
            indexOfField = index
          }
        }
      })
      return [...objStmts, 
              `(i32.add (i32.const ${indexOfField * 4}))`,
              `i32.load`]
    case "parexpr":
      const innerExprs = codeGenExpr(expr.expr, locals, classes)
      return innerExprs
    case "uniexpr":
      var uniExprs = codeGenExpr(expr.expr, locals, classes)
      if (expr.a === "bool") {
        uniExprs.push(`(i32.const 1)`)
        uniExprs.push(`(i32.xor)`)
      }
      if (expr.op === "-") {
        uniExprs = [`(i32.const 0)`].concat(uniExprs)
        uniExprs.push(`(i32.sub)`)
      }
      return uniExprs
  }
}

export function codeGenStmt(stmt : Stmt<Type>, locals: Env, classes: ClassEnv) : Array<string> {
  switch(stmt.tag) {
    case "define":
      const withParamsAndVariables = new Map<string, boolean>(locals.entries())
      // Construct the environment for the function body
      const variables = variableNames(stmt.body)
      variables.forEach(v => withParamsAndVariables.set(v, true))
      stmt.parameters.forEach(p => withParamsAndVariables.set(p.name, true))

      const params = stmt.parameters.map(p => `(param $${p.name} i32)`).join(" ")
      const varDecls = variables.map(v => `(local $${v} i32)`).join("\n")

      const stmts = stmt.body.map(s => codeGenStmt(s, withParamsAndVariables, classes)).flat()
      const stmtsBody = stmts.join("\n")
      return [`(func $${stmt.name} ${params} (result i32)
        (local $scratch i32)
        ${varDecls}
        ${stmtsBody}
        (i32.const 0))`]
    case "return":
      var valStmts = codeGenExpr(stmt.value, locals, classes)
      valStmts.push("return")
      return valStmts
    case "pass":
      return []
    case "declare":
      var valStmts = codeGenExpr(stmt.literal, locals, classes)
      if(locals.has(stmt.var.name)) { valStmts.push(`(local.set $${stmt.var.name})`) }
      else { valStmts.push(`(global.set $${stmt.var.name})`) }
      return valStmts
    case "assign":
      var valStmts = codeGenExpr(stmt.value, locals, classes)  
      if (stmt.lhs.tag === "id") {
        if(locals.has(stmt.lhs.name)) { valStmts.push(`(local.set $${stmt.lhs.name})`) }
        else {
          if (locals.keys.length === 0) {
            valStmts.push(`(global.set $${stmt.lhs.name})`)
          } else {
          throw new Error(`CompileError: Cannot assign to variables not explicitly declared in this scope: ${stmt.lhs.name}`)
          }
        }
        return valStmts
      }
      else {
        if (stmt.lhs.tag !== "getfield") {
          throw new Error(`CompileError: Unknown left hand side type ${stmt.lhs.tag} in AssignStatement`)
        }
        const objStmts = codeGenExpr(stmt.lhs.obj, locals, classes)
        if (!(stmt.lhs.obj.a !== "int" && stmt.lhs.obj.a !== "bool" && stmt.lhs.obj.a !== "none")) {
          throw new Error(`CompileError: Expected object type for getfield, got ${stmt.lhs.obj.a} instead`)
        }
        const fileds = classes.get(stmt.lhs.obj.a.class)[0]
        const fieldname = stmt.lhs.name
        var indexOfField : number = 0
        fileds.forEach((f, index) => {
          if (f.tag === "declare") {
            if (f.var.name === fieldname) {
              indexOfField = index
            }
          }
        })
        return [...objStmts, 
                `(i32.add (i32.const ${indexOfField * 4}))`,
                ...valStmts,
                `i32.store`]
      }
    case "expr":
      const result = codeGenExpr(stmt.expr, locals, classes)
      result.push("(local.set $scratch)")
      return result
    case "while":
      var condExprs = codeGenExpr(stmt.cond, locals, classes).flat().join('\n')
      var bodyStmts = stmt.body.map(s => codeGenStmt(s, locals, classes)).flat().join('\n')
      return [`(block $myblock
              (loop $myloop
              ${condExprs}
              (i32.const 1)
              (i32.xor)
              (br_if $myblock)
              ${bodyStmts}
              (br $myloop)
              ))`]
    case "if":
      var condExprs = codeGenExpr(stmt.cond, locals, classes).flat().join('\n')
      var bodyStmts = stmt.body.map(s => codeGenStmt(s, locals, classes)).flat().join('\n')
      if (typeof stmt.elifcond !== "undefined") {
        var elifcondExprs = codeGenExpr(stmt.elifcond, locals, classes).flat().join('\n')
        var elifbodyStmts = stmt.elifbody.map(s => codeGenStmt(s, locals, classes)).flat().join('\n')
      } 
      if (typeof stmt.elsebody !== "undefined") {
        var elsebodyStmts = stmt.elsebody.map(s => codeGenStmt(s, locals, classes)).flat().join('\n')
      }
      if (typeof stmt.elifcond !== "undefined" && typeof stmt.elsebody !== "undefined") {
        return [`${condExprs}
                (if
                (then ${bodyStmts})
                (else
                ${elifcondExprs}
                (if
                (then ${elifbodyStmts})
                (else ${elsebodyStmts})
                )
                )
                )`]
      }
      else if (typeof stmt.elifcond !== "undefined") {
        return [`${condExprs}
        (if
        (then ${bodyStmts})
        (else
        ${elifcondExprs}
        (if
        (then ${elifbodyStmts})
        )
        )
        )`]
      }
      else if (typeof stmt.elsebody !== "undefined") {
        return [`${condExprs}
        (if
        (then ${bodyStmts})
        (else ${elsebodyStmts})
        )`]
      }
      else {
        return [`${condExprs}
        (if
        (then ${bodyStmts})
        )`]
      }
  }
}

export function compile(source : string) : string {
  let ast = parseProgram(source)
  ast = tcProgram(ast)
  const emptyEnv = new Map<string, boolean>()
  const [vars, classes, funs, stmts] = varsClassesFunsStmts(ast)
  const methods : Stmt<Type>[] = []
  classes.forEach((value, classname) => {
    value[1].forEach(s => {
      if (s.tag === "define") {
        s.name = classname+"$"+s.name
        methods.push(s)
      }
    })
  })
  const funsCode : string[] = funs.concat(methods).map(f => codeGenStmt(f, emptyEnv, classes)).map(f => f.join("\n"))
  const allFuns = funsCode.join("\n\n")
  const varDecls = vars.map(v => `(global $${v} (mut i32) (i32.const 0))`).join("\n")

  const allStmts = stmts.map(s => codeGenStmt(s, emptyEnv, classes)).flat()

  const main = [`(local $scratch i32)`, ...allStmts].join("\n")

  const lastStmt = ast[ast.length - 1]
  const isExpr = lastStmt.tag === "expr"
  var retType = ""
  var retVal = ""
  if(isExpr) {
    retType = "(result i32)"
    retVal = "(local.get $scratch)"
  }

  return `(module
(import "imports" "mem" (memory 10))
(func $print_num (import "imports" "print_num") (param i32) (result i32))
(func $print_bool (import "imports" "print_bool") (param i32) (result i32))
(func $print_none (import "imports" "print_none") (param i32) (result i32))
(func $abs (import "imports" "abs") (param i32) (result i32))
(func $min (import "imports" "min") (param i32 i32) (result i32))
(func $max (import "imports" "max") (param i32 i32) (result i32))
(func $pow (import "imports" "pow") (param i32 i32) (result i32))
(global $heap (mut i32) (i32.const 0))
${varDecls}
${allFuns}
(func (export "_start") ${retType}
${main}
${retVal})
)`
}

export async function run(watSource : string, config: any) : Promise<number> {
  const wabtApi = await wabt()
  const importObject = config.importObject
  const parsed = wabtApi.parseWat("compiled", watSource)
  const binary = parsed.toBinary({})
  const wasmModule = await WebAssembly.instantiate(binary.buffer, importObject)
  return (wasmModule.instance.exports as any)._start()
}