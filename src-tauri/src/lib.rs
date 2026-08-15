mod agents;
mod commands;
mod error;
mod frontmatter;
mod llm;
mod remote;
mod scanner;
mod settings;
mod skill;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(llm::TranslateState::default())
        .manage(remote::RemoteState::default())
        .setup(|app| {
            use tauri::Manager;
            // 启动时按设置决定是否启用窗口亚克力透明
            let dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let s = settings::SettingsStore::new(dir).load();
            if s.fancy_background {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_effects(commands::fancy_effects().build());
                }
            }
            Ok(())
        })
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
            commands::get_agent_dir,
            commands::check_translation,
            commands::translate_skill,
            commands::replace_with_translation,
            commands::translate_all,
            commands::cancel_translate_all,
            commands::count_replaceable_translations,
            commands::replace_all_with_translations,
            commands::test_deepseek,
            commands::set_window_fancy,
            commands::list_remote_skills,
            commands::fetch_remote_skill,
            commands::install_remote_skill,
            commands::ai_read_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
