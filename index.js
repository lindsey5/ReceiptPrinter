import express from 'express';
const app = express();
const PORT = process.env.PORT || 8000;
import escpos from "escpos";
import escposUSB from "escpos-usb";

escpos.USB = escposUSB;

// Middleware to parse JSON
app.use(express.json());

// Print route
app.post('/api/print', (req, res) => {
    try {
      const { items, order } = req.body;
      const device = new escpos.USB(0x0FE6, 0x811E); // your printer IDs
      const printer = new escpos.Printer(device);

      device.open((err) => {
        if (err) {
          console.error("Printer open error:", err);
          return res.status(500).json({ success: false, error: err.message });
        }

        // --- Header ---
        printer
          .font('A')
          .align("CT")
          .style("B")
          .size(0, 0)
          .text("RM's Collection")
          .style("NORMAL")
          .size(0, 0)
          .text(new Date().toLocaleString())
          .text("--------------------------------");

        // --- Order Info ---
        printer.align("LT").font('A').size(0, 0);
        printer.text(`Order: ${order.order_id}`);
        printer.text(`Cashier: ${order.cashier.firstname} ${order.cashier.lastname}`);
        printer.text(`Payment: ${order.paymentMethod.toUpperCase()}`);
        printer.text("--------------------------------");

        // --- Table Header ---
        printer.text("Item         Qty  Price  Total");
        printer.text("--------------------------------");

        // --- Items ---
        items.forEach((item) => {
          const name = (item.name || "Unknown").slice(0, 12).padEnd(12, " ");
          const qty = item.quantity.toString().padStart(3, " ");
          const price = item.price.toFixed(2).padStart(6, " ");
          const total = item.lineTotal.toFixed(2).padStart(7, " ");
          printer.text(`${name} ${qty} ${price} ${total}`);

          if (item.attributes && item.attributes.size > 0) {
            const attrs = Array.from(item.attributes.entries())
              .map(([key, value]) => `${key}: ${value.trim()}`)
              .join(", ");
            printer.text(`  ${attrs}`);
          }
        });

        // --- Totals & Payment ---
        printer.text("--------------------------------");
        printer.align("RT").style("B");
        printer.text(`Subtotal: ${order.total.toFixed(2)}`);
        printer.text(`Payment:  ${order.paymentAmount.toFixed(2)}`);
        printer.text(`Change:   ${order.change.toFixed(2)}`);
        printer.text("--------------------------------");

        // --- Footer ---
        printer.align("CT").style("NORMAL");
        printer.text("Thank you for shopping!");
        printer.text("RM's Collection");
        printer.text("--------------------------------");
        printer.feed(2);

        // Cut paper & close connection
        printer.cut();
        printer.close();

        res.status(200).json({ success: true });
      });
    } catch (err) {
      console.error("Receipt print error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
