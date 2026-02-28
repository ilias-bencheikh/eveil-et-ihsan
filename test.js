import React, { useState, useMemo } from 'react';
import { Calculator, Save, Trash2, Download, Moon, Sun } from 'lucide-react';

const App = () => {
  // Initialisation des données pour 30 nuits
  const initialData = Array.from({ length: 30 }, (_, i) => ({
    nuit: i + 1,
    monnaie: '',
    espece: '',
    cb: '',
    cheque: ''
  }));

  const [data, setData] = useState(initialData);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Gestion des changements dans les cellules
  const handleChange = (index, field, value) => {
    const newData = [...data];
    // On n'accepte que les nombres ou une chaîne vide
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      newData[index][field] = value;
      setData(newData);
    }
  };

  // Calcul du total d'une nuit spécifique
  const calculateRowTotal = (row) => {
    return (parseFloat(row.monnaie) || 0) + 
           (parseFloat(row.espece) || 0) + 
           (parseFloat(row.cb) || 0) + 
           (parseFloat(row.cheque) || 0);
  };

  // Calculs globaux pour le second tableau
  const totals = useMemo(() => {
    return data.reduce((acc, row) => {
      acc.monnaie += parseFloat(row.monnaie) || 0;
      acc.espece += parseFloat(row.espece) || 0;
      acc.cb += parseFloat(row.cb) || 0;
      acc.cheque += parseFloat(row.cheque) || 0;
      return acc;
    }, { monnaie: 0, espece: 0, cb: 0, cheque: 0 });
  }, [data]);

  const totalGeneral = totals.monnaie + totals.espece + totals.cb + totals.cheque;

  const resetData = () => {
    if (window.confirm("Voulez-vous vraiment effacer toutes les données ?")) {
      setData(initialData);
    }
  };

  const printTable = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen p-4 md:p-8 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg">
              <Moon size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Collecte du Ramadan</h1>
              <p className="opacity-70 text-sm">Gestion des 30 nuits de générosité</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={printTable}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
            >
              <Download size={18} /> Imprimer / PDF
            </button>
            <button 
              onClick={resetData}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-medium"
            >
              <Trash2 size={18} /> Reset
            </button>
          </div>
        </div>

        {/* Premier Tableau : Détail des nuits */}
        <div className={`overflow-hidden rounded-2xl border shadow-sm mb-8 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                  <th className="p-4 font-semibold text-sm">Nuit</th>
                  <th className="p-4 font-semibold text-sm">Monnaie (€)</th>
                  <th className="p-4 font-semibold text-sm">Espèce (€)</th>
                  <th className="p-4 font-semibold text-sm">CB (€)</th>
                  <th className="p-4 font-semibold text-sm">Chèque (€)</th>
                  <th className="p-4 font-semibold text-sm text-right">Total Nuit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {data.map((row, idx) => (
                  <tr key={row.nuit} className={`${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                    <td className="p-4 font-medium text-emerald-600">Nuit {row.nuit}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.monnaie}
                        onChange={(e) => handleChange(idx, 'monnaie', e.target.value)}
                        placeholder="0"
                        className={`w-full p-2 rounded-md border text-right focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.espece}
                        onChange={(e) => handleChange(idx, 'espece', e.target.value)}
                        placeholder="0"
                        className={`w-full p-2 rounded-md border text-right focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.cb}
                        onChange={(e) => handleChange(idx, 'cb', e.target.value)}
                        placeholder="0"
                        className={`w-full p-2 rounded-md border text-right focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.cheque}
                        onChange={(e) => handleChange(idx, 'cheque', e.target.value)}
                        placeholder="0"
                        className={`w-full p-2 rounded-md border text-right focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                      />
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      {calculateRowTotal(row).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Second Tableau : Récapitulatif Total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className={`p-6 rounded-2xl border shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calculator className="text-emerald-500" />
              Récapitulatif Général
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                <span className="font-medium">Total Monnaie</span>
                <span className="text-lg">{totals.monnaie.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                <span className="font-medium">Total Espèces</span>
                <span className="text-lg">{totals.espece.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                <span className="font-medium">Total CB</span>
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {totals.cb.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                <span className="font-medium">Total Chèques</span>
                <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                  {totals.cheque.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>
              
              <div className="pt-4 mt-2 border-t border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-600 text-white shadow-md">
                  <span className="text-lg font-bold">TOTAL GÉNÉRAL</span>
                  <span className="text-2xl font-black">{totalGeneral.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-2xl border border-dashed ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-gray-300 bg-gray-50'}`}>
            <h3 className="font-bold mb-4 opacity-70">Notes & Instructions</h3>
            <ul className="text-sm space-y-3 opacity-80">
              <li>• Saisissez les montants nuit par nuit dans le tableau principal.</li>
              <li>• Les totaux se mettent à jour instantanément dans le panneau de droite.</li>
              <li>• Utilisez le bouton "Imprimer" pour sauvegarder une copie PDF ou papier.</li>
              <li>• Les données saisies ne sont pas sauvegardées sur un serveur. Ne fermez pas la page avant d'avoir fini ou imprimé.</li>
            </ul>
          </div>
        </div>

        <footer className="mt-12 text-center opacity-50 text-xs">
          Système de gestion de collecte • Ramadan 2024/2025
        </footer>
      </div>
    </div>
  );
};

export default App;