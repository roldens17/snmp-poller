import { Calendar, ListChecks, FileText, Briefcase, Download } from 'lucide-react';

export function Reports() {
    const reports = [
        { title: 'Weekly Summary', description: 'High-level operational metrics and status summary for the last 7 days.', icon: Calendar },
        { title: 'Change History', description: 'Detailed log of configuration changes, device additions, and firmware updates.', icon: ListChecks },
        { title: 'Inventory PDF Export', description: 'Generate a complete PDF document of all network assets (devices and switches).', icon: FileText },
        { title: 'MSP Client Reports', description: 'Generate performance and SLA reports tailored for specific managed service clients.', icon: Briefcase },
    ];

    return (
        <div className="fade-in">
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Reports Center</h2>
                <p className="text-gray-400 text-sm">Generate compliance, inventory, and health reports.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reports.map((r, i) => (
                    <div key={i} className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 flex flex-col justify-between hover:border-amber-500/50 transition duration-300">
                        <div>
                            <div className="p-3 bg-gray-700 rounded-lg w-fit mb-4">
                                <r.icon className="w-8 h-8 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-white">{r.title}</h3>
                            <p className="text-sm text-gray-400 mb-6">{r.description}</p>
                        </div>
                        <button className="w-full bg-gray-700 hover:bg-amber-600 hover:text-white text-gray-200 font-medium py-2.5 rounded-lg transition duration-200 flex items-center justify-center border border-gray-600 hover:border-transparent">
                            <Download className="w-4 h-4 mr-2" /> Generate
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
