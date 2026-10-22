/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { unescapeXml } from './schema';

export class XmlElement {
  public tag: string;
  public attrs: Record<string, string>;
  public children: XmlElement[];
  public text: string;

  constructor(tag: string, attrs: Record<string, string> = {}, text = '') {
    this.tag = tag;
    this.attrs = attrs;
    this.children = [];
    this.text = text;
  }

  public findChild(tagName: string): XmlElement | undefined {
    const target = tagName.toLowerCase();
    return this.children.find((c) => c.tag.toLowerCase() === target);
  }

  public findChildren(tagName: string): XmlElement[] {
    const target = tagName.toLowerCase();
    return this.children.filter((c) => c.tag.toLowerCase() === target);
  }

  public getChildText(tagName: string): string | undefined {
    const child = this.findChild(tagName);
    return child ? child.text.trim() : undefined;
  }
}

/**
 * Parses XML attributes from the attribute string inside an opening tag.
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_\-:]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1];
    const val = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] || '';
    attrs[name] = unescapeXml(val);
  }

  return attrs;
}

/**
 * Pure TypeScript XML parser that constructs an XmlElement tree.
 * Works uniformly in Node.js and browser environments.
 * Throws a descriptive Error if the XML is malformed or unclosed.
 */
export function parseXml(xmlString: string): XmlElement {
  if (!xmlString || typeof xmlString !== 'string' || !xmlString.trim()) {
    throw new Error('Empty or non-string XML input');
  }

  // Remove XML declaration and comments and DOCTYPE
  let cleanXml = xmlString
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  cleanXml = cleanXml.trim();
  if (!cleanXml) {
    throw new Error('XML contains no root element');
  }

  const tagRegex = /<(?:\/([a-zA-Z0-9_\-:]+)|([a-zA-Z0-9_\-:]+)((?:\s+[^=>\/]+=(?:"[^"]*"|'[^']*'|[^\s>]+))*)\s*(\/)?)\s*>/g;

  let root: XmlElement | null = null;
  const stack: XmlElement[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleanXml)) !== null) {
    const textBetween = cleanXml.substring(lastIndex, match.index);
    if (textBetween && stack.length > 0) {
      const trimmed = textBetween.trim();
      if (trimmed) {
        stack[stack.length - 1].text += (stack[stack.length - 1].text ? ' ' : '') + unescapeXml(trimmed);
      }
    }

    const isClosing = Boolean(match[1]);
    const tagName = match[1] || match[2];
    const attrString = match[3] || '';
    const isSelfClosing = Boolean(match[4]);

    if (isClosing) {
      if (stack.length === 0) {
        throw new Error(`Unexpected closing tag </${tagName}> without open tag`);
      }
      const top = stack.pop()!;
      if (top.tag.toLowerCase() !== tagName.toLowerCase()) {
        throw new Error(`Mismatched closing tag </${tagName}>, expected </${top.tag}>`);
      }
    } else {
      const attrs = parseAttributes(attrString);
      const element = new XmlElement(tagName, attrs);

      if (stack.length === 0) {
        if (root !== null) {
          throw new Error(`Multiple root elements detected (<${root.tag}> and <${tagName}>)`);
        }
        root = element;
      } else {
        stack[stack.length - 1].children.push(element);
      }

      if (!isSelfClosing) {
        stack.push(element);
      }
    }

    lastIndex = tagRegex.lastIndex;
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed XML tag <${stack[stack.length - 1].tag}>`);
  }

  if (!root) {
    throw new Error('No root XML element found');
  }

  return root;
}
