import QtQuick
import QtQuick.Controls.Basic

// Period chips, plus two date fields for a custom range.
Flow {
    id: bar
    property string period: "30d"
    property string fromText: ""
    property string toText: ""
    // The chosen range, or null while a custom range is incomplete.
    readonly property var range: Api.range(period, fromText, toText)

    spacing: 6

    Repeater {
        model: Api.periods
        Chip {
            required property var modelData
            text: modelData.label
            selected: bar.period === modelData.id
            onClicked: bar.period = modelData.id
        }
    }

    component DateField: TextField {
        visible: bar.period === "custom"
        width: 124
        height: 34
        leftPadding: 12
        placeholderText: "YYYY-MM-DD"
        color: Theme.text
        placeholderTextColor: Theme.muted
        font.pixelSize: 13
        background: Rectangle {
            radius: 14
            color: Theme.surface
            border.color: parent.activeFocus ? Theme.pink : "transparent"
        }
    }
    DateField { text: bar.fromText; onEditingFinished: bar.fromText = text }
    DateField { text: bar.toText; onEditingFinished: bar.toText = text }
}
