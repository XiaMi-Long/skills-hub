use std::fs;
use std::path::Path;

use uuid::Uuid;

use crate::skill::OnConflict;

pub struct SyncOutcome {
    pub skipped: Vec<std::path::PathBuf>,
}

/// stage_then_replace 复制引擎(spec §5):
/// 1. 复制到同目录 `.skills-hub-staging-<uuid>`(symlink 跳过记入 skipped);
/// 2. 完成后若 target 存在 remove_dir_all;
/// 3. rename(staging, target) 最后一步,中断不毁原目录;
/// 4. 中途错 best-effort 删 staging。
fn stage_then_replace(src: &Path, target: &Path) -> Result<SyncOutcome, String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("目标父目录无效: {}", target.display()))?;
    let staging = parent.join(format!(".skills-hub-staging-{}", Uuid::new_v4()));
    let mut skipped: Vec<std::path::PathBuf> = Vec::new();

    let result = (|| -> Result<(), String> {
        fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
        for entry in walkdir::WalkDir::new(src)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let rel = entry
                .path()
                .strip_prefix(src)
                .map_err(|e| e.to_string())?;
            let dest = staging.join(rel);
            if entry.file_type().is_symlink() {
                skipped.push(entry.path().to_path_buf());
                continue;
            }
            if entry.file_type().is_dir() {
                fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            } else if entry.file_type().is_file() {
                if let Some(p) = dest.parent() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            // 提交:先删旧,再 rename(最后一步)
            if target.exists() {
                fs::remove_dir_all(target).map_err(|e| e.to_string())?;
            }
            fs::rename(&staging, target).map_err(|e| e.to_string())?;
            Ok(SyncOutcome { skipped })
        }
        Err(msg) => {
            let _ = fs::remove_dir_all(&staging); // best-effort 清理
            Err(msg)
        }
    }
}

/// 同步一个 skill 目录到目标 parent。
/// target 已存在:Skip → Ok 不动;Overwrite → stage_then_replace。
pub fn sync_one(
    src_dir: &Path,
    target_parent: &Path,
    on_conflict: OnConflict,
) -> Result<SyncOutcome, String> {
    let name = src_dir
        .file_name()
        .ok_or_else(|| format!("源路径无效: {}", src_dir.display()))?;
    let target = target_parent.join(name);

    if target.exists() {
        match on_conflict {
            OnConflict::Skip => return Ok(SyncOutcome { skipped: vec![] }),
            OnConflict::Overwrite => {}
        }
    }
    stage_then_replace(src_dir, &target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn make_tree(root: &std::path::Path) -> std::path::PathBuf {
        let src = root.join("src-skill");
        fs::create_dir_all(src.join("sub")).unwrap();
        fs::write(src.join("SKILL.md"), "# Hello").unwrap();
        fs::write(src.join("sub").join("note.txt"), "note").unwrap();
        src
    }

    #[test]
    fn overwrite_replaces_content() {
        let dir = tempdir().unwrap();
        let src = make_tree(dir.path());
        let target_parent = dir.path().join("agents");
        fs::create_dir_all(&target_parent).unwrap();
        let target = target_parent.join("src-skill");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("SKILL.md"), "# Old").unwrap();

        sync_one(&src, &target_parent, OnConflict::Overwrite).unwrap();
        assert_eq!(
            fs::read_to_string(target.join("SKILL.md")).unwrap(),
            "# Hello"
        );
        assert!(target.join("sub").join("note.txt").exists());
        // 无 staging 残留
        let leftovers: Vec<_> = fs::read_dir(&target_parent)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(".skills-hub-staging"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn skip_does_not_touch_existing() {
        let dir = tempdir().unwrap();
        let src = make_tree(dir.path());
        let target_parent = dir.path().join("agents");
        fs::create_dir_all(&target_parent).unwrap();
        let target = target_parent.join("src-skill");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("SKILL.md"), "# Keep").unwrap();

        sync_one(&src, &target_parent, OnConflict::Skip).unwrap();
        assert_eq!(
            fs::read_to_string(target.join("SKILL.md")).unwrap(),
            "# Keep"
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlink_skipped_and_recorded() {
        let dir = tempdir().unwrap();
        let src = make_tree(dir.path());
        std::os::unix::fs::symlink("SKILL.md", src.join("link.md")).unwrap();
        let target_parent = dir.path().join("agents");
        fs::create_dir_all(&target_parent).unwrap();

        let outcome = sync_one(&src, &target_parent, OnConflict::Overwrite).unwrap();
        assert_eq!(outcome.skipped.len(), 1);
        assert!(!target_parent.join("src-skill").join("link.md").exists());
    }

    #[test]
    fn fresh_copy_works() {
        let dir = tempdir().unwrap();
        let src = make_tree(dir.path());
        let target_parent = dir.path().join("agents");
        fs::create_dir_all(&target_parent).unwrap();
        sync_one(&src, &target_parent, OnConflict::Overwrite).unwrap();
        let target = target_parent.join("src-skill");
        assert_eq!(
            fs::read_to_string(target.join("SKILL.md")).unwrap(),
            "# Hello"
        );
        assert!(target.join("sub").join("note.txt").exists());
    }
}
