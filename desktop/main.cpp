#include <QFont>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    // Names the settings file and ties the window to lastfm-stats.desktop (icon, app id).
    app.setOrganizationName("lastfm-stats");
    app.setApplicationName("lastfm-stats");
    app.setDesktopFileName("lastfm-stats");
    QQuickStyle::setStyle("Basic");
    app.setFont(QFont("Rubik")); // falls back to the system font if it is not installed

    QQmlApplicationEngine engine;
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(1); }, Qt::QueuedConnection);
    engine.loadFromModule("Stats", "Main");
    return app.exec();
}
