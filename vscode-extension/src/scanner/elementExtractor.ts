import * as fs from 'fs'

export interface InteractiveElement {
  tag: string
  id?: string
  classes: string[]
  type?: string
  name?: string
  placeholder?: string
  ariaLabel?: string
  dataTestId?: string
  dataGuideId?: string
  innerText?: string
  cssSelector: string
  role?: string
  line: number
  rawOpeningTag: string
}

export interface ExtractedElementsResult {
  filePath: string
  elements: InteractiveElement[]
}

/**
 * Extracts attribute value from an HTML/JSX/Svelte opening tag.
 */
function extractAttr(tag: string, attrName: string): string | undefined {
  // Support attr="value", attr='value', attr={value}
  const regex = new RegExp(`${attrName}=(?:["']([^"']*)["']|{([^}]*)})`, 'i')
  const match = tag.match(regex)
  if (match) {
    return (match[1] || match[2] || '').trim()
  }
  return undefined
}

/**
 * Computes a resilient, standard CSS selector for an element.
 */
export function computeCssSelector(el: Partial<InteractiveElement>): string {
  if (el.dataGuideId) {
    return `[data-guide-id="${el.dataGuideId}"]`
  }
  if (el.dataTestId) {
    return `[data-testid="${el.dataTestId}"]`
  }
  if (el.id) {
    return `#${el.id}`
  }
  if (el.name) {
    return `${el.tag}[name="${el.name}"]`
  }
  if (el.classes && el.classes.length > 0) {
    return `${el.tag}.${el.classes.slice(0, 2).join('.')}`
  }
  return el.tag || 'button'
}

/**
 * Determines role for target_fingerprint based on tag and type.
 */
export function inferRole(tag: string, type?: string): string {
  if (tag === 'button' || (tag === 'input' && (type === 'submit' || type === 'button'))) return 'button'
  if (tag === 'a') return 'link'
  if (tag === 'input' || tag === 'textarea') return 'textbox'
  if (tag === 'select') return 'combobox'
  if (tag === 'form') return 'form'
  return 'button'
}

/**
 * Parses a file's content and extracts interactive elements.
 */
export function extractElements(filePath: string, content?: string): InteractiveElement[] {
  const code = content !== undefined ? content : fs.readFileSync(filePath, 'utf-8')
  const elements: InteractiveElement[] = []

  // Regex matching opening tags for interactive elements: button, input, select, a, form
  // e.g. <button ...> or <input .../>
  const tagRegex = /<(button|input|select|textarea|a|form)\b([^>]*?)(\/?>)/gi
  const lines = code.split('\n')

  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(code)) !== null) {
    const fullTag = match[0]
    const tagName = match[1].toLowerCase()
    const attrString = match[2]

    // Calculate line number
    const offset = match.index
    const line = code.slice(0, offset).split('\n').length

    const id = extractAttr(attrString, 'id')
    const classAttr = extractAttr(attrString, 'class') || extractAttr(attrString, 'className')
    const classes = classAttr ? classAttr.split(/\s+/).filter(Boolean) : []
    const type = extractAttr(attrString, 'type')
    const name = extractAttr(attrString, 'name')
    const placeholder = extractAttr(attrString, 'placeholder')
    const ariaLabel = extractAttr(attrString, 'aria-label')
    const dataTestId = extractAttr(attrString, 'data-testid')
    const dataGuideId = extractAttr(attrString, 'data-guide-id')

    // Find inner text if not self-closing and has closing tag nearby
    let innerText: string | undefined
    if (tagName === 'button' || tagName === 'a' || tagName === 'label') {
      const closeTagIndex = code.indexOf(`</${tagName}>`, match.index)
      if (closeTagIndex !== -1 && closeTagIndex - match.index < 400) {
        const between = code.slice(match.index + fullTag.length, closeTagIndex)
        // Strip nested HTML tags
        const stripped = between.replace(/<[^>]+>/g, '').trim()
        if (stripped) {
          innerText = stripped.replace(/\s+/g, ' ')
        }
      }
    }

    const cssSelector = computeCssSelector({
      tag: tagName,
      id,
      classes,
      name,
      dataTestId,
      dataGuideId,
    })

    const role = inferRole(tagName, type)

    elements.push({
      tag: tagName,
      id,
      classes,
      type,
      name,
      placeholder,
      ariaLabel,
      dataTestId,
      dataGuideId,
      innerText,
      cssSelector,
      role,
      line,
      rawOpeningTag: fullTag,
    })
  }

  return elements
}

