const formatter = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const formatNumber = (value: number): string => {
    return formatter.format(value);
};
