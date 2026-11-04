use tauri_plugin_dialog::DialogExt;

/// Abre el diálogo "Guardar como" del sistema y escribe el archivo elegido.
/// Devuelve `false` si la persona cancela. Lo usan la copia de seguridad y,
/// más adelante, la exportación a CSV para el gestor.
#[tauri::command]
async fn guardar_archivo(
    app: tauri::AppHandle,
    nombre: String,
    contenido: String,
    descripcion: String,
    extension: String,
) -> Result<bool, String> {
    let ruta = app
        .dialog()
        .file()
        .set_file_name(&nombre)
        .add_filter(&descripcion, &[extension.as_str()])
        .blocking_save_file();
    let Some(ruta) = ruta else {
        return Ok(false);
    };
    let ruta = ruta.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&ruta, contenido).map_err(|e| format!("No se pudo escribir el archivo: {e}"))?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![guardar_archivo])
        .run(tauri::generate_context!())
        .expect("no se pudo arrancar Neto");
}
