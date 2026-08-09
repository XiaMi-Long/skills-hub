use gray_matter::engine::YAML;
use gray_matter::Pod;
use gray_matter::Matter;

pub struct ParsedFrontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    #[allow(dead_code)] // body 由 read_skill_md 原文直接提供,当前不用
    pub body: String,
}

/// 解析 SKILL.md:gray_matter 切 frontmatter,Pod 取 name/description。
/// 兜底链(YAML 坏 → name=None;name None → dirname;description None → ""):
/// 此处只返回 Option,由调用方兜底。任何分支不 panic。
pub fn parse_skill_md(text: &str) -> ParsedFrontmatter {
    let parsed = Matter::<YAML>::new().parse(text);
    let data = parsed.data;
    let body = parsed.content;

    let mut name = None;
    let mut description = None;
    if let Some(Pod::Hash(map)) = data {
        if let Some(Pod::String(s)) = map.get("name") {
            name = Some(s.clone());
        }
        if let Some(Pod::String(s)) = map.get("description") {
            description = Some(s.trim_end().to_string());
        }
    }

    ParsedFrontmatter {
        name,
        description,
        body,
    }
}

/// 读 SKILL.md 原文;失败/非 UTF-8 用 lossy 兜底,返回 (text, ok)。
pub fn read_skill_md_lossy(path: &std::path::Path) -> (String, bool) {
    match std::fs::read(path) {
        Ok(bytes) => (String::from_utf8_lossy(&bytes).into_owned(), true),
        Err(_) => (String::new(), false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_frontmatter() {
        let fm = parse_skill_md("---\nname: foo\ndescription: bar\n---\n\nbody text\n");
        assert_eq!(fm.name.as_deref(), Some("foo"));
        assert_eq!(fm.description.as_deref(), Some("bar"));
    }

    #[test]
    fn folded_description_becomes_single_string() {
        let fm = parse_skill_md("---\nname: x\ndescription: >\n  line one\n  line two\n---\n\nbody\n");
        assert_eq!(fm.description.as_deref(), Some("line one line two"));
    }

    #[test]
    fn no_frontmatter_falls_back() {
        let fm = parse_skill_md("just body without frontmatter");
        assert_eq!(fm.name, None);
        assert_eq!(fm.description, None);
        assert!(fm.body.contains("just body"));
    }

    #[test]
    fn bad_yaml_does_not_panic() {
        // name 是数组 → 不是 String → name=None,不 panic
        let fm = parse_skill_md("---\nname: [1, 2\ndescription: ok\n---\n\nbody\n");
        assert_eq!(fm.name, None);
        let fm2 = parse_skill_md("---\n: : :\n---\n\nbody\n");
        assert_eq!(fm2.name, None);
        let fm3 = parse_skill_md("not even frontmatter delimiters");
        assert_eq!(fm3.name, None);
    }
}
