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
            description = Some(s.clone());
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
