import { Fragment } from "./fragment";
import { Slice } from "./replace";
import { Mark } from "./mark";
import { Schema, NodeType, MarkType } from "./schema";
import { ParseRule, ParseOptions, NodeSpec, ParseRuleForTag, ParseRuleForStyle } from "./types";
import { Node as ProsemirrorNode, TextNode } from "./node";
import { ContentMatch } from "./content";

// ParseOptions:: interface
// These are the options recognized by the
// [`parse`](#model.DOMParser.parse) and
// [`parseSlice`](#model.DOMParser.parseSlice) methods.
//
//   preserveWhitespace:: ?union<bool, "full">
//   By default, whitespace is collapsed as per HTML's rules. Pass
//   `true` to preserve whitespace, but normalize newlines to
//   spaces, and `"full"` to preserve whitespace entirely.
//
//   findPositions:: ?[{node: dom.Node, offset: number}]
//   When given, the parser will, beside parsing the content,
//   record the document positions of the given DOM positions. It
//   will do so by writing to the objects, adding a `pos` property
//   that holds the document position. DOM positions that are not
//   in the parsed content will not be written to.
//
//   from:: ?number
//   The child node index to start parsing from.
//
//   to:: ?number
//   The child node index to stop parsing at.
//
//   topNode:: ?Node
//   By default, the content is parsed into the schema's default
//   [top node type](#model.Schema.topNodeType). You can pass this
//   option to use the type and attributes from a different node
//   as the top container.
//
//   topMatch:: ?ContentMatch
//   Provide the starting content match that content parsed into the
//   top node is matched against.
//
//   context:: ?ResolvedPos
//   A set of additional nodes to count as
//   [context](#model.ParseRule.context) when parsing, above the
//   given [top node](#model.ParseOptions.topNode).

// ParseRule:: interface
// A value that describes how to parse a given DOM node or inline
// style as a ProseMirror node or mark.
//
//   tag:: ?string
//   A CSS selector describing the kind of DOM elements to match. A
//   single rule should have _either_ a `tag` or a `style` property.
//
//   namespace:: ?string
//   The namespace to match. This should be used with `tag`.
//   Nodes are only matched when the namespace matches or this property
//   is null.
//
//   style:: ?string
//   A CSS property name to match. When given, this rule matches
//   inline styles that list that property. May also have the form
//   `"property=value"`, in which case the rule only matches if the
//   propery's value exactly matches the given value. (For more
//   complicated filters, use [`getAttrs`](#model.ParseRule.getAttrs)
//   and return false to indicate that the match failed.)
//
//   priority:: ?number
//   Can be used to change the order in which the parse rules in a
//   schema are tried. Those with higher priority come first. Rules
//   without a priority are counted as having priority 50. This
//   property is only meaningful in a schema—when directly
//   constructing a parser, the order of the rule array is used.
//
//   context:: ?string
//   When given, restricts this rule to only match when the current
//   context—the parent nodes into which the content is being
//   parsed—matches this expression. Should contain one or more node
//   names or node group names followed by single or double slashes.
//   For example `"paragraph/"` means the rule only matches when the
//   parent node is a paragraph, `"blockquote/paragraph/"` restricts
//   it to be in a paragraph that is inside a blockquote, and
//   `"section//"` matches any position inside a section—a double
//   slash matches any sequence of ancestor nodes. To allow multiple
//   different contexts, they can be separated by a pipe (`|`)
//   character, as in `"blockquote/|list_item/"`.
//
//   node:: ?string
//   The name of the node type to create when this rule matches. Only
//   valid for rules with a `tag` property, not for style rules. Each
//   rule should have one of a `node`, `mark`, or `ignore` property
//   (except when it appears in a [node](#model.NodeSpec.parseDOM) or
//   [mark spec](#model.MarkSpec.parseDOM), in which case the `node`
//   or `mark` property will be derived from its position).
//
//   mark:: ?string
//   The name of the mark type to wrap the matched content in.
//
//   ignore:: ?bool
//   When true, ignore content that matches this rule.
//
//   skip:: ?bool
//   When true, ignore the node that matches this rule, but do parse
//   its content.
//
//   attrs:: ?Object
//   Attributes for the node or mark created by this rule. When
//   `getAttrs` is provided, it takes precedence.
//
//   getAttrs:: ?(union<dom.Node, string>) → ?union<Object, false>
//   A function used to compute the attributes for the node or mark
//   created by this rule. Can also be used to describe further
//   conditions the DOM element or style must match. When it returns
//   `false`, the rule won't match. When it returns null or undefined,
//   that is interpreted as an empty/default set of attributes.
//
//   Called with a DOM Element for `tag` rules, and with a string (the
//   style's value) for `style` rules.
//
//   contentElement:: ?union<string, (dom.Node) → dom.Node>
//   For `tag` rules that produce non-leaf nodes or marks, by default
//   the content of the DOM element is parsed as content of the mark
//   or node. If the child nodes are in a descendent node, this may be
//   a CSS selector string that the parser must use to find the actual
//   content element, or a function that returns the actual content
//   element to the parser.
//
//   getContent:: ?(dom.Node, schema: Schema) → Fragment
//   Can be used to override the content of a matched node. When
//   present, instead of parsing the node's child nodes, the result of
//   this function is used.
//
//   preserveWhitespace:: ?union<bool, "full">
//   Controls whether whitespace should be preserved when parsing the
//   content inside the matched element. `false` means whitespace may
//   be collapsed, `true` means that whitespace should be preserved
//   but newlines normalized to spaces, and `"full"` means that
//   newlines should also be preserved.

// ::- A DOM parser represents a strategy for parsing DOM content into
// a ProseMirror document conforming to a given schema. Its behavior
// is defined by an array of [rules](#model.ParseRule).
export class DOMParser<S extends Schema = any> {
  /**
   * The schema into which the parser parses.
   */
  schema: Schema;
  /**
   * The set of [parse rules](#model.ParseRule) that the parser
   * uses, in order of precedence.
   */
  rules: ParseRule[];

  tags: ParseRuleForTag[];
  styles: ParseRuleForStyle[];

  // :: (Schema, [ParseRule])
  // Create a parser that targets the given schema, using the given
  // parsing rules.
  constructor(schema: S, rules: ParseRule[]) {
    // :: Schema
    // The schema into which the parser parses.
    this.schema = schema;
    // :: [ParseRule]
    // The set of [parse rules](#model.ParseRule) that the parser
    // uses, in order of precedence.
    this.rules = rules;
    this.tags = [];
    this.styles = [];

    rules.forEach((rule) => {
      if (rule.tag) this.tags.push(rule as ParseRuleForTag);
      else if (rule.style) this.styles.push(rule as ParseRuleForStyle);
    });
  }

  // :: (dom.Node, ?ParseOptions) → Node
  // Parse a document from the content of a DOM node.
  parse(dom: Node, options: ParseOptions = {}) {
    let context = new ParseContext(this, options, false);
    context.addAll(dom, null, options.from, options.to);
    return context.finish();
  }

  // :: (dom.Node, ?ParseOptions) → Slice
  // Parses the content of the given DOM node, like
  // [`parse`](#model.DOMParser.parse), and takes the same set of
  // options. But unlike that method, which produces a whole node,
  // this one returns a slice that is open at the sides, meaning that
  // the schema constraints aren't applied to the start of nodes to
  // the left of the input and the end of nodes at the end.
  parseSlice(dom: Node, options: ParseOptions = {}) {
    let context = new ParseContext(this, options, true);
    context.addAll(dom, null, options.from, options.to);
    return Slice.maxOpen(context.finish() as Fragment);
  }

  matchTag(dom: Node, context: ParseContext) {
    for (let i = 0; i < this.tags.length; i++) {
      let rule = this.tags[i];
      if (
        matches(dom as Element, rule.tag) &&
        (rule.namespace === undefined || dom.namespaceURI == rule.namespace) &&
        (!rule.context || context.matchesContext(rule.context))
      ) {
        if (rule.getAttrs) {
          let result = rule.getAttrs(dom);
          if (result === false) continue;
          rule.attrs = result;
        }
        return rule;
      }
    }
  }

  matchStyle(prop: string, value: any, context: ParseContext) {
    for (let i = 0; i < this.styles.length; i++) {
      let rule = this.styles[i];
      if (
        rule.style.indexOf(prop) != 0 ||
        (rule.context && !context.matchesContext(rule.context)) ||
        // Test that the style string either precisely matches the prop,
        // or has an '=' sign after the prop, followed by the given
        // value.
        (rule.style.length > prop.length &&
          (rule.style.charCodeAt(prop.length) != 61 || rule.style.slice(prop.length + 1) != value))
      )
        continue;
      if (rule.getAttrs) {
        let result = rule.getAttrs(value);
        if (result === false) continue;
        rule.attrs = result;
      }
      return rule;
    }
  }

  // : (Schema) → [ParseRule]
  static schemaRules(schema: Schema): ParseRule[] {
    let result = [];
    function insert(rule: ParseRule) {
      let priority = rule.priority == null ? 50 : rule.priority,
        i = 0;
      for (; i < result.length; i++) {
        let next = result[i],
          nextPriority = next.priority == null ? 50 : next.priority;
        if (nextPriority < priority) break;
      }
      result.splice(i, 0, rule);
    }

    for (let name in schema.marks) {
      let rules = schema.marks[name].spec.parseDOM;
      if (rules)
        rules.forEach((rule) => {
          insert((rule = copy(rule)));
          rule.mark = name;
        });
    }
    for (let name in schema.nodes) {
      let rules = schema.nodes[name].spec.parseDOM;
      if (rules)
        rules.forEach((rule) => {
          insert((rule = copy(rule)));
          rule.node = name;
        });
    }
    return result;
  }

  // :: (Schema) → DOMParser
  // Construct a DOM parser using the parsing rules listed in a
  // schema's [node specs](#model.NodeSpec.parseDOM), reordered by
  // [priority](#model.ParseRule.priority).
  static fromSchema(schema: Schema) {
    return schema.cached.domParser || (schema.cached.domParser = new DOMParser(schema, DOMParser.schemaRules(schema)));
  }
}

// : Object<bool> The block-level tags in HTML5
const blockTags = {
  address: true,
  article: true,
  aside: true,
  blockquote: true,
  canvas: true,
  dd: true,
  div: true,
  dl: true,
  fieldset: true,
  figcaption: true,
  figure: true,
  footer: true,
  form: true,
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
  header: true,
  hgroup: true,
  hr: true,
  li: true,
  noscript: true,
  ol: true,
  output: true,
  p: true,
  pre: true,
  section: true,
  table: true,
  tfoot: true,
  ul: true,
};

// : Object<bool> The tags that we normally ignore.
const ignoreTags = {
  head: true,
  noscript: true,
  object: true,
  script: true,
  style: true,
  title: true,
};

// : Object<bool> List tags.
const listTags = { ol: true, ul: true };

// Using a bitfield for node context options
const OPT_PRESERVE_WS = 1,
  OPT_PRESERVE_WS_FULL = 2,
  OPT_OPEN_LEFT = 4;

function wsOptionsFor(preserveWhitespace?: ParseOptions["preserveWhitespace"]) {
  return (preserveWhitespace ? OPT_PRESERVE_WS : 0) | (preserveWhitespace === "full" ? OPT_PRESERVE_WS_FULL : 0);
}

class NodeContext {
  type: NodeType;
  attrs: NodeSpec["attrs"];
  solid: boolean;
  match: ContentMatch;
  options: any;
  content: Array<ProsemirrorNode>;
  marks: Mark[];
  activeMarks: any;

  constructor(
    type: NodeType,
    attrs: NodeSpec["attrs"],
    marks: Mark[],
    solid: boolean,
    match: ContentMatch,
    options: any
  ) {
    this.type = type;
    this.attrs = attrs;
    this.solid = solid;
    this.match = match || (options & OPT_OPEN_LEFT ? null : type.contentMatch);
    this.options = options;
    this.content = [];
    this.marks = marks;
    this.activeMarks = Mark.none;
  }

  findWrapping(node: ProsemirrorNode) {
    if (!this.match) {
      if (!this.type) return [];
      let fill = this.type.contentMatch.fillBefore(Fragment.from(node) as Fragment);
      if (fill) {
        this.match = this.type.contentMatch.matchFragment(fill);
      } else {
        let start = this.type.contentMatch,
          wrap: Array<NodeType> | null | undefined;
        if ((wrap = start.findWrapping(node.type))) {
          this.match = start;
          return wrap;
        } else {
          return null;
        }
      }
    }
    return this.match.findWrapping(node.type);
  }

  finish(openEnd?: boolean) {
    if (!(this.options & OPT_PRESERVE_WS)) {
      // Strip trailing whitespace
      let last = this.content[this.content.length - 1],
        m: any;
      if (last && last.isText && (m = /[ \t\r\n\u000c]+$/.exec(last.text))) {
        if (last.text.length == m[0].length) this.content.pop();
        else
          this.content[this.content.length - 1] = (last as TextNode).withText(
            last.text.slice(0, last.text.length - m[0].length)
          );
      }
    }
    let content = Fragment.from(this.content) as Fragment;
    if (!openEnd && this.match) content = content.append(this.match.fillBefore(Fragment.empty, true));
    return this.type ? this.type.create(this.attrs, content, this.marks) : content;
  }
}

class ParseContext {
  parser: DOMParser;
  options: ParseOptions;
  isOpen: boolean;
  pendingMarks: Mark[];

  nodes: NodeContext[];
  open: number;
  find: Array<{ node: Node; offset: number; pos?: number | null }> | null;
  needsBlock: boolean;

  // : (DOMParser, Object)
  constructor(parser: DOMParser, options: ParseOptions, open: boolean) {
    // : DOMParser The parser we are using.
    this.parser = parser;
    // : Object The options passed to this parse.
    this.options = options;
    this.isOpen = open;
    this.pendingMarks = [];
    let topNode = options.topNode,
      topContext: NodeContext;
    let topOptions = wsOptionsFor(options.preserveWhitespace) | (open ? OPT_OPEN_LEFT : 0);
    if (topNode)
      topContext = new NodeContext(
        topNode.type,
        topNode.attrs,
        Mark.none,
        true,
        options.topMatch || topNode.type.contentMatch,
        topOptions
      );
    else if (open) topContext = new NodeContext(null, null, Mark.none, true, null, topOptions);
    else topContext = new NodeContext(parser.schema.topNodeType, null, Mark.none, true, null, topOptions);
    this.nodes = [topContext];
    // : [Mark] The current set of marks
    this.open = 0;
    this.find = options.findPositions;
    this.needsBlock = false;
  }

  get top() {
    return this.nodes[this.open];
  }

  // : (dom.Node)
  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(dom: Node) {
    if (dom.nodeType == 3) {
      this.addTextNode(dom);
    }
    // XXX 原代码中没有，使用者添加的  && dom instanceof Element
    else if (dom.nodeType == 1) {
      let style = (dom as Element).getAttribute("style");
      let marks = style ? this.readStyles(parseStyles(style)) : null;
      if (marks != null) for (let i = 0; i < marks.length; i++) this.addPendingMark(marks[i]);
      this.addElement(dom as Element);
      if (marks != null) for (let i = 0; i < marks.length; i++) this.removePendingMark(marks[i]);
    }
  }

  addTextNode(dom: Node) {
    let value = dom.nodeValue;
    let top = this.top;
    if (
      (top.type ? top.type.inlineContent : top.content.length && top.content[0].isInline) ||
      /[^ \t\r\n\u000c]/.test(value)
    ) {
      if (!(top.options & OPT_PRESERVE_WS)) {
        value = value.replace(/[ \t\r\n\u000c]+/g, " ");
        // If this starts with whitespace, and there is no node before it, or
        // a hard break, or a text node that ends with whitespace, strip the
        // leading space.
        if (/^[ \t\r\n\u000c]/.test(value) && this.open == this.nodes.length - 1) {
          let nodeBefore = top.content[top.content.length - 1];
          let domNodeBefore = dom.previousSibling;
          if (
            !nodeBefore ||
            (domNodeBefore && domNodeBefore.nodeName == "BR") ||
            (nodeBefore.isText && /[ \t\r\n\u000c]$/.test(nodeBefore.text))
          )
            value = value.slice(1);
        }
      } else if (!(top.options & OPT_PRESERVE_WS_FULL)) {
        value = value.replace(/\r?\n|\r/g, " ");
      }
      if (value) this.insertNode(this.parser.schema.text(value));
      this.findInText(dom);
    } else {
      this.findInside(dom);
    }
  }

  // : (dom.Element)
  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(dom: Element) {
    let name = dom.nodeName.toLowerCase();
    if (listTags.hasOwnProperty(name)) normalizeList(dom);
    let rule = (this.options.ruleFromNode && this.options.ruleFromNode(dom)) || this.parser.matchTag(dom, this);
    if (rule ? rule.ignore : ignoreTags.hasOwnProperty(name)) {
      this.findInside(dom);
    } else if (!rule || rule.skip) {
      if (rule && (rule.skip as Element).nodeType) dom = rule.skip as Element;
      let sync: boolean,
        top = this.top,
        oldNeedsBlock = this.needsBlock;
      if (blockTags.hasOwnProperty(name)) {
        sync = true;
        if (!top.type) this.needsBlock = true;
      } else if (!dom.firstChild) {
        this.leafFallback(dom);
        return;
      }
      this.addAll(dom);
      if (sync) this.sync(top);
      this.needsBlock = oldNeedsBlock;
    } else {
      this.addElementByRule(dom, rule);
    }
  }

  // Called for leaf DOM nodes that would otherwise be ignored
  leafFallback(dom: Node) {
    if (dom.nodeName == "BR" && this.top.type && this.top.type.inlineContent)
      this.addTextNode(dom.ownerDocument.createTextNode("\n"));
  }

  // Run any style parser associated with the node's styles. Either
  // return an array of marks, or null to indicate some of the styles
  // had a rule with `ignore` set.
  readStyles(styles: string[]) {
    let marks = Mark.none;
    for (let i = 0; i < styles.length; i += 2) {
      let rule = this.parser.matchStyle(styles[i], styles[i + 1], this);
      if (!rule) continue;
      if (rule.ignore) return null;
      marks = this.parser.schema.marks[rule.mark].create(rule.attrs).addToSet(marks);
    }
    return marks;
  }

  // : (dom.Element, ParseRule) → bool
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  addElementByRule(dom: Element, rule: ParseRule) {
    let sync: boolean, nodeType: NodeType, markType: MarkType, mark: Mark;
    if (rule.node) {
      nodeType = this.parser.schema.nodes[rule.node];
      if (!nodeType.isLeaf) {
        sync = this.enter(nodeType, rule.attrs, rule.preserveWhitespace);
      } else if (!this.insertNode(nodeType.create(rule.attrs))) {
        this.leafFallback(dom);
      }
    } else {
      markType = this.parser.schema.marks[rule.mark];
      mark = markType.create(rule.attrs);
      this.addPendingMark(mark);
    }
    let startIn = this.top;

    if (nodeType && nodeType.isLeaf) {
      this.findInside(dom);
    } else if (rule.getContent) {
      this.findInside(dom);
      rule.getContent(dom, this.parser.schema).forEach((node) => this.insertNode(node));
    } else {
      let contentDOM: string | ((p: Node) => Node) | null | Element | Node = rule.contentElement;
      if (typeof contentDOM == "string") contentDOM = dom.querySelector(contentDOM);
      else if (typeof contentDOM == "function") contentDOM = contentDOM(dom);
      if (!contentDOM) contentDOM = dom;
      this.findAround(dom, contentDOM, true);
      this.addAll(contentDOM, sync);
    }
    if (sync) {
      this.sync(startIn);
      this.open--;
    }
    if (mark) this.removePendingMark(mark);
  }

  // : (dom.Node, ?NodeBuilder, ?number, ?number)
  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(parent: Node, sync?: any, startIndex?: number, endIndex?: number) {
    let index = startIndex || 0;
    for (
      let dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild,
        end = endIndex == null ? null : parent.childNodes[endIndex];
      dom != end;
      dom = dom.nextSibling, ++index
    ) {
      this.findAtPoint(parent, index);
      this.addDOM(dom);
      if (sync && blockTags.hasOwnProperty(dom.nodeName.toLowerCase())) this.sync(sync);
    }
    this.findAtPoint(parent, index);
  }

  // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.
  findPlace(node: ProsemirrorNode) {
    let route: any[], sync: any;
    for (let depth = this.open; depth >= 0; depth--) {
      let cx = this.nodes[depth];
      let found = cx.findWrapping(node);
      if (found && (!route || route.length > found.length)) {
        route = found;
        sync = cx;
        if (!found.length) break;
      }
      if (cx.solid) break;
    }
    if (!route) return false;
    this.sync(sync);
    for (let i = 0; i < route.length; i++) this.enterInner(route[i], null, false);
    return true;
  }

  // : (Node) → ?Node
  // Try to insert the given node, adjusting the context when needed.
  insertNode(node: ProsemirrorNode) {
    if (node.isInline && this.needsBlock && !this.top.type) {
      let block = this.textblockFromContext();
      if (block) this.enterInner(block);
    }
    if (this.findPlace(node)) {
      this.closeExtra();
      let top = this.top;
      this.applyPendingMarks(top);
      if (top.match) top.match = top.match.matchType(node.type);
      let marks = top.activeMarks;
      for (let i = 0; i < node.marks.length; i++)
        if (!top.type || top.type.allowsMarkType(node.marks[i].type)) marks = node.marks[i].addToSet(marks);
      top.content.push(node.mark(marks));
      return true;
    }
    return false;
  }

  applyPendingMarks(top: NodeContext) {
    for (let i = 0; i < this.pendingMarks.length; i++) {
      let mark = this.pendingMarks[i];
      if ((!top.type || top.type.allowsMarkType(mark.type)) && !mark.isInSet(top.activeMarks)) {
        top.activeMarks = mark.addToSet(top.activeMarks);
        this.pendingMarks.splice(i--, 1);
      }
    }
  }

  // : (NodeType, ?Object) → bool
  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(type: NodeType, attrs?: { [key: string]: any }, preserveWS?: ParseRule["preserveWhitespace"]) {
    let ok = this.findPlace(type.create(attrs));
    if (ok) {
      this.applyPendingMarks(this.top);
      this.enterInner(type, attrs, true, preserveWS);
    }
    return ok;
  }

  // Open a node of the given type
  enterInner(type: NodeType, attrs?: NodeType["attrs"], solid?: boolean, preserveWS?: ParseRule["preserveWhitespace"]) {
    this.closeExtra();
    let top = this.top;
    // XXX 不需要 attrs 属性
    // top.match = top.match && top.match.matchType(type, attrs);
    top.match = top.match && top.match.matchType(type);
    let options = preserveWS == null ? top.options & ~OPT_OPEN_LEFT : wsOptionsFor(preserveWS);
    if (top.options & OPT_OPEN_LEFT && top.content.length == 0) options |= OPT_OPEN_LEFT;
    this.nodes.push(new NodeContext(type, attrs, top.activeMarks, solid, null, options));
    this.open++;
  }

  // Make sure all nodes above this.open are finished and added to
  // their parents
  closeExtra(openEnd?: boolean) {
    let i = this.nodes.length - 1;
    if (i > this.open) {
      for (; i > this.open; i--) this.nodes[i - 1].content.push(this.nodes[i].finish(openEnd) as ProsemirrorNode);
      this.nodes.length = this.open + 1;
    }
  }

  finish() {
    this.open = 0;
    this.closeExtra(this.isOpen);
    return this.nodes[0].finish(this.isOpen || this.options.topOpen);
  }

  sync(to: NodeContext) {
    for (let i = this.open; i >= 0; i--)
      if (this.nodes[i] == to) {
        this.open = i;
        return;
      }
  }

  addPendingMark(mark: Mark) {
    this.pendingMarks.push(mark);
  }

  removePendingMark(mark: Mark) {
    let found = this.pendingMarks.lastIndexOf(mark);
    if (found > -1) {
      this.pendingMarks.splice(found, 1);
    } else {
      let top = this.top;
      top.activeMarks = mark.removeFromSet(top.activeMarks);
    }
  }

  get currentPos() {
    this.closeExtra();
    let pos = 0;
    for (let i = this.open; i >= 0; i--) {
      let content = this.nodes[i].content;
      for (let j = content.length - 1; j >= 0; j--) pos += content[j].nodeSize;
      if (i) pos++;
    }
    return pos;
  }

  findAtPoint(parent: Node, offset: number) {
    if (this.find)
      for (let i = 0; i < this.find.length; i++) {
        if (this.find[i].node == parent && this.find[i].offset == offset) this.find[i].pos = this.currentPos;
      }
  }

  findInside(parent: Node) {
    if (this.find)
      for (let i = 0; i < this.find.length; i++) {
        if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node))
          this.find[i].pos = this.currentPos;
      }
  }

  findAround(parent: Node, content: Node, before: boolean) {
    if (parent != content && this.find)
      for (let i = 0; i < this.find.length; i++) {
        if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) {
          let pos = content.compareDocumentPosition(this.find[i].node);
          if (pos & (before ? 2 : 4)) this.find[i].pos = this.currentPos;
        }
      }
  }

  findInText(textNode: Node) {
    if (this.find)
      for (let i = 0; i < this.find.length; i++) {
        if (this.find[i].node == textNode)
          this.find[i].pos = this.currentPos - (textNode.nodeValue.length - this.find[i].offset);
      }
  }

  // : (string) → bool
  // Determines whether the given [context
  // string](#ParseRule.context) matches this context.
  matchesContext(context: string): boolean {
    if (context.indexOf("|") > -1) return context.split(/\s*\|\s*/).some(this.matchesContext, this);

    let parts = context.split("/");
    let option = this.options.context;
    let useRoot = !this.isOpen && (!option || option.parent.type == this.nodes[0].type);
    let minDepth = -(option ? option.depth + 1 : 0) + (useRoot ? 0 : 1);
    let match = (i: number, depth: number) => {
      for (; i >= 0; i--) {
        let part = parts[i];
        if (part == "") {
          if (i == parts.length - 1 || i == 0) continue;
          for (; depth >= minDepth; depth--) if (match(i - 1, depth)) return true;
          return false;
        } else {
          let next =
            depth > 0 || (depth == 0 && useRoot)
              ? this.nodes[depth].type
              : option && depth >= minDepth
              ? option.node(depth - minDepth).type
              : null;
          if (!next || (next.name != part && next.groups.indexOf(part) == -1)) return false;
          depth--;
        }
      }
      return true;
    };
    return match(parts.length - 1, this.open);
  }

  textblockFromContext() {
    let $context = this.options.context;
    if ($context)
      for (let d = $context.depth; d >= 0; d--) {
        let deflt = $context.node(d).contentMatchAt($context.indexAfter(d)).defaultType;
        if (deflt && deflt.isTextblock && deflt.defaultAttrs) return deflt;
      }
    for (let name in this.parser.schema.nodes) {
      let type = this.parser.schema.nodes[name];
      if (type.isTextblock && type.defaultAttrs) return type;
    }
  }
}

// Kludge to work around directly nested list nodes produced by some
// tools and allowed by browsers to mean that the nested list is
// actually part of the list item above it.
function normalizeList(dom: Node) {
  for (let child = dom.firstChild, prevItem = null; child; child = child.nextSibling) {
    let name = child.nodeType == 1 ? child.nodeName.toLowerCase() : null;
    if (name && listTags.hasOwnProperty(name) && prevItem) {
      prevItem.appendChild(child);
      child = prevItem;
    } else if (name == "li") {
      prevItem = child;
    } else if (name) {
      prevItem = null;
    }
  }
}

// Apply a CSS selector.
function matches(dom: Element, selector: string) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(
    dom,
    selector
  );
}

// : (string) → [string]
// Tokenize a style attribute into property/value pairs.
function parseStyles(style: string): string[] {
  let re = /\s*([\w-]+)\s*:\s*([^;]+)/g,
    m: string[],
    result: string[] = [];
  while ((m = re.exec(style))) result.push(m[1], m[2].trim());
  return result;
}

function copy(obj: { [key: string]: any }) {
  let copy = {};
  for (let prop in obj) copy[prop] = obj[prop];
  return copy;
}
