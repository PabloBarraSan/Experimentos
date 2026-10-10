/**
 * Mezcla una lectura del rodillo en los datos en vivo.
 *
 * Muchos rodillos FTMS incluyen el campo de pulso aunque no tengan sensor y lo envían
 * como 0 en cada paquete. Si se copiara tal cual, borraría el pulso que acaba de llegar
 * de la banda Bluetooth. El pulso solo se acepta si la lectura del rodillo es válida.
 */
export function mergeTrainerData(liveData, data = {}) {
    const { heartRate, ...rest } = data;
    Object.assign(liveData, rest);
    if (Number(heartRate) > 0) liveData.heartRate = heartRate;
    return liveData;
}
