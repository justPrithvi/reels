import { html as beautifyHtml } from 'js-beautify';

export const formatHTML = (htmlString: string): string => {
  try {
    return beautifyHtml(htmlString, {
      indent_size: 2,
      indent_char: ' ',
      max_preserve_newlines: 2,
      preserve_newlines: true,
      keep_array_indentation: false,
      break_chained_methods: false,
      indent_scripts: 'normal',
      brace_style: 'collapse',
      space_before_conditional: true,
      unescape_strings: false,
      jslint_happy: false,
      end_with_newline: true,
      wrap_line_length: 0,
      indent_inner_html: true,
      comma_first: false,
      e4x: false,
      indent_empty_lines: false
    });
  } catch (error) {
    console.error('HTML formatting error:', error);
    return htmlString; // Return original if formatting fails
  }
};

export const formatJSON = (jsonString: string): string => {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    console.error('JSON formatting error:', error);
    return jsonString;
  }
};
