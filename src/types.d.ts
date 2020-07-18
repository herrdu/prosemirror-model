import { Node as ProsemirrorNode } from "./node";

/**
 * Used to [define](#model.NodeSpec.attrs) attributes on nodes or
 * marks.
 */
export interface AttributeSpec {
  /**
   * The default value for this attribute, to use when no explicit
   * value is provided. Attributes that have no default must be
   * provided whenever a node or mark of a type that has them is
   * created.
   */
  default?: any;
}

export interface NodeSpec {
  /**
   * The content expression for this node, as described in the [schema
   * guide](/docs/guide/#schema.content_expressions). When not given,
   * the node does not allow any content.
   */
  content?: string | null;
  /**
   * The marks that are allowed inside of this node. May be a
   * space-separated string referring to mark names or groups, `"_"`
   * to explicitly allow all marks, or `""` to disallow marks. When
   * not given, nodes with inline content default to allowing all
   * marks, other nodes default to not allowing marks.
   */
  marks?: string | null;
  /**
   * The group or space-separated groups to which this node belongs,
   * which can be referred to in the content expressions for the
   * schema.
   */
  group?: string | null;
  /**
   * Should be set to true for inline nodes. (Implied for text nodes.)
   */
  inline?: boolean | null;
  /**
   * Can be set to true to indicate that, though this isn't a [leaf
   * node](#model.NodeType.isLeaf), it doesn't have directly editable
   * content and should be treated as a single unit in the view.
   */
  atom?: boolean | null;
  /**
   * The attributes that nodes of this type get.
   */
  attrs?: { [name: string]: AttributeSpec } | null;
  /**
   * Controls whether nodes of this type can be selected as a [node
   * selection](#state.NodeSelection). Defaults to true for non-text
   * nodes.
   */
  selectable?: boolean | null;
  /**
   * Determines whether nodes of this type can be dragged without
   * being selected. Defaults to false.
   */
  draggable?: boolean | null;
  /**
   * Can be used to indicate that this node contains code, which
   * causes some commands to behave differently.
   */
  code?: boolean | null;
  /**
   * Determines whether this node is considered an important parent
   * node during replace operations (such as paste). Non-defining (the
   * default) nodes get dropped when their entire content is replaced,
   * whereas defining nodes persist and wrap the inserted content.
   * Likewise, in _inserted_ content the defining parents of the
   * content are preserved when possible. Typically,
   * non-default-paragraph textblock types, and possibly list items,
   * are marked as defining.
   */
  defining?: boolean | null;
  /**
   * When enabled (default is false), the sides of nodes of this type
   * count as boundaries that regular editing operations, like
   * backspacing or lifting, won't cross. An example of a node that
   * should probably have this enabled is a table cell.
   */
  isolating?: boolean | null;
  /**
   * Defines the default way a node of this type should be serialized
   * to DOM/HTML (as used by
   * [`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)).
   * Should return a DOM node or an [array
   * structure](#model.DOMOutputSpec) that describes one, with an
   * optional number zero (“hole”) in it to indicate where the node's
   * content should be inserted.
   *
   * For text nodes, the default is to create a text DOM node. Though
   * it is possible to create a serializer where text is rendered
   * differently, this is not supported inside the editor, so you
   * shouldn't override that in your text node spec.
   */
  toDOM?: ((node: ProsemirrorNode) => DOMOutputSpec) | null;
  /**
   * Associates DOM parser information with this node, which can be
   * used by [`DOMParser.fromSchema`](#model.DOMParser^fromSchema) to
   * automatically derive a parser. The `node` field in the rules is
   * implied (the name of this node will be filled in automatically).
   * If you supply your own parser, you do not need to also specify
   * parsing rules in your schema.
   */
  parseDOM?: ParseRule[] | null;
  /**
   * Defines the default way a node of this type should be serialized
   * to a string representation for debugging (e.g. in error messages).
   */
  toDebugString?: ((node: ProsemirrorNode) => string) | null;
  /**
   * Allow specifying arbitrary fields on a NodeSpec.
   */
  [key: string]: any;
}

export interface DOMOutputSpecArray {
  0: string;
  1?: DOMOutputSpec | 0 | { [attr: string]: string };
  2?: DOMOutputSpec | 0;
  3?: DOMOutputSpec | 0;
  4?: DOMOutputSpec | 0;
  5?: DOMOutputSpec | 0;
  6?: DOMOutputSpec | 0;
  7?: DOMOutputSpec | 0;
  8?: DOMOutputSpec | 0;
  9?: DOMOutputSpec | 0;
}
export type DOMOutputSpec = string | Node | DOMOutputSpecArray;

/**
 * A value that describes how to parse a given DOM node or inline
 * style as a ProseMirror node or mark.
 */
export interface ParseRule {
  /**
   * A CSS selector describing the kind of DOM elements to match. A
   * single rule should have _either_ a `tag` or a `style` property.
   */
  tag?: string | null;
  /**
   * The namespace to match. This should be used with `tag`.
   * Nodes are only matched when the namespace matches or this property
   * is null.
   */
  namespace?: string | null;
  /**
   * A CSS property name to match. When given, this rule matches
   * inline styles that list that property. May also have the form
   * `"property=value"`, in which case the rule only matches if the
   * propery's value exactly matches the given value. (For more
   * complicated filters, use [`getAttrs`](#model.ParseRule.getAttrs)
   * and return undefined to indicate that the match failed.)
   */
  style?: string | null;
  /**
   * Can be used to change the order in which the parse rules in a
   * schema are tried. Those with higher priority come first. Rules
   * without a priority are counted as having priority 50. This
   * property is only meaningful in a schema—when directly
   * constructing a parser, the order of the rule array is used.
   */
  priority?: number | null;
  /**
   * When given, restricts this rule to only match when the current
   * context—the parent nodes into which the content is being
   * parsed—matches this expression. Should contain one or more node
   * names or node group names followed by single or double slashes.
   * For example `"paragraph/"` means the rule only matches when the
   * parent node is a paragraph, `"blockquote/paragraph/"` restricts
   * it to be in a paragraph that is inside a blockquote, and
   * `"section//"` matches any position inside a section—a double
   * slash matches any sequence of ancestor nodes. To allow multiple
   * different contexts, they can be separated by a pipe (`|`)
   * character, as in `"blockquote/|list_item/"`.
   */
  context?: string | null;
  /**
   * The name of the node type to create when this rule matches. Only
   * valid for rules with a `tag` property, not for style rules. Each
   * rule should have one of a `node`, `mark`, or `ignore` property
   * (except when it appears in a [node](#model.NodeSpec.parseDOM) or
   * [mark spec](#model.MarkSpec.parseDOM), in which case the `node`
   * or `mark` property will be derived from its position).
   */
  node?: string | null;
  /**
   * The name of the mark type to wrap the matched content in.
   */
  mark?: string | null;
  /**
   * When true, ignore content that matches this rule.
   */
  ignore?: boolean | null;
  /**
   * When true, ignore the node that matches this rule, but do parse
   * its content.
   */
  skip?: boolean | null;
  /**
   * Attributes for the node or mark created by this rule. When
   * `getAttrs` is provided, it takes precedence.
   */
  attrs?: { [key: string]: any } | null;
  /**
   * A function used to compute the attributes for the node or mark
   * created by this rule. Can also be used to describe further
   * conditions the DOM element or style must match. When it returns
   * `false`, the rule won't match. When it returns null or undefined,
   * that is interpreted as an empty/default set of attributes.
   *
   * Called with a DOM Element for `tag` rules, and with a string (the
   * style's value) for `style` rules.
   */
  getAttrs?: ((p: Node | string) => { [key: string]: any } | false | null | undefined) | null;
  /**
   * For `tag` rules that produce non-leaf nodes or marks, by default
   * the content of the DOM element is parsed as content of the mark
   * or node. If the child nodes are in a descendent node, this may be
   * a CSS selector string that the parser must use to find the actual
   * content element, or a function that returns the actual content
   * element to the parser.
   */
  contentElement?: string | ((p: Node) => Node) | null;
  /**
   * Can be used to override the content of a matched node. When
   * present, instead of parsing the node's child nodes, the result of
   * this function is used.
   */
  getContent?: (<S extends Schema = any>(p: Node, schema: S) => Fragment<S>) | null;
  /**
   * Controls whether whitespace should be preserved when parsing the
   * content inside the matched element. `false` means whitespace may
   * be collapsed, `true` means that whitespace should be preserved
   * but newlines normalized to spaces, and `"full"` means that
   * newlines should also be preserved.
   */
  preserveWhitespace?: boolean | "full" | null;
}
