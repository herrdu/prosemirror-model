const assert = require("assert")
const {Fragment} = require("../src/")
const {schema, doc, blockquote, p, li, ul, em, strong, code, a, br, hr, img} = require("./build")

function docEq(a, b, msg) {
  if (!a.eq(b)) assert.fail(a.toString(), b.toString(), msg)
}

describe("Node", () => {
  describe("toString", () => {
    it("nests", () => {
      assert.equal(doc(ul(li(p("hey"), p()), li(p("foo")))).toString(),
                   'doc(bullet_list(list_item(paragraph("hey"), paragraph), list_item(paragraph("foo"))))')
    })

    it("shows inline children", () => {
      assert.equal(doc(p("foo", img, br, "bar")).toString(),
                   'doc(paragraph("foo", image, hard_break, "bar"))')
    })

    it("shows marks", () => {
      assert.equal(doc(p("foo", em("bar", strong("quux")), code("baz"))).toString(),
                   'doc(paragraph("foo", em("bar"), em(strong("quux")), code("baz")))')
    })
  })

  describe("cut", () => {
    function cut(doc, cut) {
      docEq(doc.cut(doc.tag.a || 0, doc.tag.b), cut)
    }

    it("extracts a full block", () =>
       cut(doc(p("foo"), "<a>", p("bar"), "<b>", p("baz")),
           doc(p("bar"))))

    it("cuts text", () =>
       cut(doc(p("0"), p("foo<a>bar<b>baz"), p("2")),
           doc(p("bar"))))

    it("cuts deeply", () =>
       cut(doc(blockquote(ul(li(p("a"), p("b<a>c")), li(p("d")), "<b>", li(p("e"))), p("3"))),
           doc(blockquote(ul(li(p("c")), li(p("d")))))))

    it("works from the left", () =>
       cut(doc(blockquote(p("foo<b>bar"))),
           doc(blockquote(p("foo")))))

    it("works to the right", () =>
       cut(doc(blockquote(p("foo<a>bar"))),
           doc(blockquote(p("bar")))))

    it("preserves marks", () =>
       cut(doc(p("foo", em("ba<a>r", img, strong("baz"), br), "qu<b>ux", code("xyz"))),
           doc(p(em("r", img, strong("baz"), br), "qu"))))
  })

  describe("between", () => {
    function between(doc, ...nodes) {
      let i = 0
      doc.nodesBetween(doc.tag.a, doc.tag.b, (node, pos) => {
        if (i == nodes.length)
          throw new Error("More nodes iterated than listed (" + node.type.name + ")")
        let compare = node.isText ? node.text : node.type.name
        if (compare != nodes[i++])
          throw new Error("Expected " + JSON.stringify(nodes[i - 1]) + ", got " + JSON.stringify(compare))
        if (!node.isText && doc.nodeAt(pos) != node)
          throw new Error("Pos " + pos + " does not point at node " + node + " " + doc.nodeAt(pos))
      })
    }

    it("iterates over text", () =>
       between(doc(p("foo<a>bar<b>baz")),
               "paragraph", "foobarbaz"))

    it("descends multiple levels", () =>
       between(doc(blockquote(ul(li(p("f<a>oo")), p("b"), "<b>"), p("c"))),
               "blockquote", "bullet_list", "list_item", "paragraph", "foo", "paragraph", "b"))

    it("iterates over inline nodes", () =>
       between(doc(p(em("x"), "f<a>oo", em("bar", img, strong("baz"), br), "quux", code("xy<b>z"))),
               "paragraph", "foo", "bar", "image", "baz", "hard_break", "quux", "xyz"))
  })

  describe("textContent", () => {
    it("works on a whole doc", () => {
      assert.equal(doc(p("foo")).textContent, "foo")
    })

    it("works on a text node", () => {
      assert.equal(schema.text("foo").textContent, "foo")
    })

    it("works on a nested element", () => {
      assert.equal(doc(ul(li(p("hi")), li(p(em("a"), "b")))).textContent,
                   "hiab")
    })
  })

  describe("from", () => {
    function from(arg, expect) {
      docEq(expect.copy(Fragment.from(arg)), expect)
    }

    it("wraps a single node", () =>
       from(schema.node("paragraph"), doc(p())))

    it("wraps an array", () =>
       from([schema.node("hard_break"), schema.text("foo")], p(br, "foo")))

    it("preserves a fragment", () =>
       from(doc(p("foo")).content, doc(p("foo"))))

    it("accepts null", () =>
       from(null, p()))

    it("joins adjacent text", () =>
       from([schema.text("a"), schema.text("b")], p("ab")))
  })

  describe("toJSON", () => {
    function roundTrip(doc) {
      assert(schema.nodeFromJSON(doc.toJSON()).eq(doc))
    }

    it("can serialize a simple node", () => roundTrip(doc(p("foo"))))

    it("can serialize marks", () => roundTrip(doc(p("foo", em("bar", strong("baz")), " ", a("x")))))

    it("can serialize inline leaf nodes", () => roundTrip(doc(p("foo", em(img, "bar")))))

    it("can serialize block leaf nodes", () => roundTrip(doc(p("a"), hr, p("b"), p())))

    it("can serialize nested nodes", () => roundTrip(doc(blockquote(ul(li(p("a"), p("b")), li(p(img))), p("c")), p("d"))))
  })
})
