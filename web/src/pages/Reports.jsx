import { Calendar, ListChecks, FileText, Briefcase, Download, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';

export function Reports() {
    const reports = [
        { title: 'Weekly Summary', description: 'High-level operational metrics and status summary for the last 7 days.', icon: Calendar },
        { title: 'Change History', description: 'Detailed log of configuration changes, device additions, and firmware updates.', icon: ListChecks },
        { title: 'Inventory PDF Export', description: 'Generate a complete PDF document of all network assets (devices and switches).', icon: FileText },
        { title: 'MSP Client Reports', description: 'Generate performance and SLA reports tailored for specific managed service clients.', icon: Briefcase },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        show: { opacity: 1, scale: 1 }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col h-full space-y-8"
        >
            <div className="flex flex-col md:flex-row justify-between items-end border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/10">
                            <PieChart className="w-6 h-6 text-gold" />
                        </div>
                        <span className="text-glow">Reports Center</span>
                    </h1>
                    <p className="text-gray-400 mt-2 ml-1">Generate compliance, inventory, and health reports.</p>
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
                {reports.map((r, i) => (
                    <motion.div
                        variants={itemVariants}
                        key={i}
                        whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                        className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-between group border border-white/5 hover:border-gold/30 transition duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-gradient-to-br from-gold/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition duration-500 blur-xl"></div>

                        <div className="relative z-10">
                            <div className="p-3 bg-white/5 rounded-xl w-fit mb-5 group-hover:bg-gold/10 transition duration-300 border border-white/5 group-hover:border-gold/20">
                                <r.icon className="w-8 h-8 text-gold-light group-hover:text-gold transition duration-300" />
                            </div>
                            <h3 className="text-lg font-bold mb-3 text-gray-100 group-hover:text-white">{r.title}</h3>
                            <p className="text-sm text-gray-400 mb-6 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 h-24">{r.description}</p>
                        </div>
                        <button className="relative z-10 w-full bg-white/5 hover:bg-gold hover:text-black text-gray-300 font-bold py-3 rounded-xl transition duration-300 flex items-center justify-center border border-white/10 hover:border-gold shadow-lg group-hover:shadow-gold/20">
                            <Download className="w-4 h-4 mr-2" />
                            <span>Generate Report</span>
                        </button>
                    </motion.div>
                ))}
            </motion.div>
        </motion.div>
    );
}
