// En Windows, evita que se abra una ventana de consola junto a la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    neto_lib::run()
}
