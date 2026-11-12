cmake_minimum_required(VERSION 3.21)
project(lastfm-stats LANGUAGES CXX)

find_package(Qt6 6.8 REQUIRED COMPONENTS Quick QuickControls2)
qt_standard_project_setup(REQUIRES 6.8)

qt_add_executable(lastfm-stats main.cpp)

set_source_files_properties(qml/Theme.qml qml/Api.qml PROPERTIES QT_QML_SINGLETON_TYPE TRUE)
qt_add_qml_module(lastfm-stats
    URI Stats
    QML_FILES
        qml/Main.qml
        qml/Theme.qml
        qml/Api.qml
        qml/Chip.qml
        qml/PeriodBar.qml
        qml/RecentView.qml
        qml/TopView.qml
        qml/TrendsView.qml
)
target_link_libraries(lastfm-stats PRIVATE Qt6::Quick Qt6::QuickControls2)

install(TARGETS lastfm-stats RUNTIME DESTINATION bin)
install(FILES lastfm-stats.desktop DESTINATION share/applications)
install(FILES ../icon.svg DESTINATION share/icons/hicolor/scalable/apps RENAME lastfm-stats.svg)
