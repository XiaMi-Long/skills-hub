mod agents;
mod commands;
mod error;
mod frontmatter;
mod llm;
mod scanner;
mod settings;
mod skill;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_all,
            commands::read_skill_md,
            commands::write_skill_md,
            commands::create_skill,
            commands::delete_skill,
            commands::sync_skill,
            commands::reveal_in_explorer,
            commands::get_settings,
            commands::save_settings,
            commands::translate_skill,
            commands::test_deepseek,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
