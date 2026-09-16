package com.travelbooking.catalogue.config;

import com.travelbooking.catalogue.model.DepartureStatus;
import com.travelbooking.catalogue.model.PackageDeparture;
import com.travelbooking.catalogue.model.TravelPackage;
import com.travelbooking.catalogue.repository.PackageDepartureRepository;
import com.travelbooking.catalogue.repository.TravelPackageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Populates the in-memory catalogue with sample packages and departures
 * on startup so the frontend search and package details work out of the box.
 *
 * Disable with {@code catalogue.seed.enabled=false}.
 */
@Component
@ConditionalOnProperty(
        name = "catalogue.seed.enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class CatalogueDataSeeder implements CommandLineRunner {

    private static final Logger log =
            LoggerFactory.getLogger(CatalogueDataSeeder.class);

    private final TravelPackageRepository packageRepository;
    private final PackageDepartureRepository departureRepository;

    public CatalogueDataSeeder(
            TravelPackageRepository packageRepository,
            PackageDepartureRepository departureRepository
    ) {
        this.packageRepository = packageRepository;
        this.departureRepository = departureRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (packageRepository.count() > 0) {
            log.info("Catalogue already contains data, skipping seed");
            return;
        }

        LocalDate today = LocalDate.now();

        seed(
                "Bali Wellness Escape",
                "Bali, Indonesia",
                "Slow mornings, lush rice terraces and a little time just for you. "
                        + "Seven nights of yoga, spa treatments and quiet beaches "
                        + "on the island's peaceful east coast.",
                List.of(
                        departure(today.plusDays(21), 7, 1299.00, 16),
                        departure(today.plusDays(49), 7, 1349.00, 16),
                        departure(today.plusDays(84), 7, 1199.00, 12)
                )
        );

        seed(
                "Tokyo Food & Culture",
                "Tokyo, Japan",
                "Follow your curiosity through lantern-lit streets, neighbourhood "
                        + "kitchens and serene temples. Ten days of markets, "
                        + "sushi masterclasses and day trips to Kamakura and Nikko.",
                List.of(
                        departure(today.plusDays(30), 10, 2450.00, 12),
                        departure(today.plusDays(75), 10, 2590.00, 12),
                        departure(today.plusDays(120), 10, 2390.00, 10)
                )
        );

        seed(
                "Swiss Alps Adventure",
                "Swiss Alps, Switzerland",
                "Fresh mountain air, turquoise lakes and trails with unforgettable "
                        + "views. Five days of guided hikes, cable-car summits and "
                        + "evenings in cosy alpine villages.",
                List.of(
                        departure(today.plusDays(14), 5, 1890.00, 10),
                        departure(today.plusDays(42), 5, 1990.00, 10),
                        departure(today.plusDays(70), 5, 1890.00, 8)
                )
        );

        seed(
                "Kyoto Autumn Temples",
                "Kyoto, Japan",
                "Wander through crimson maple gardens, bamboo groves and centuries-old "
                        + "shrines. Six days of tea ceremonies, kaiseki dinners and "
                        + "a stay in a traditional ryokan.",
                List.of(
                        departure(today.plusDays(60), 6, 2150.00, 10),
                        departure(today.plusDays(95), 6, 2250.00, 10)
                )
        );

        seed(
                "Amalfi Coast Escape",
                "Amalfi Coast, Italy",
                "Cliffside villages, lemon groves and long lunches by the sea. "
                        + "Eight days across Positano, Ravello and Capri with private "
                        + "boat days and cooking classes.",
                List.of(
                        departure(today.plusDays(35), 8, 3200.00, 12),
                        departure(today.plusDays(90), 8, 2950.00, 12)
                )
        );

        seed(
                "Patagonia Trekking Expedition",
                "Patagonia, Argentina",
                "Glaciers, granite spires and wide open skies. Twelve days of trekking "
                        + "in Los Glaciares and Torres del Paine with expert mountain "
                        + "guides and lodge stays.",
                List.of(
                        departure(today.plusDays(45), 12, 4800.00, 8),
                        departure(today.plusDays(100), 12, 4650.00, 8)
                )
        );

        seed(
                "Marrakech & Sahara Journey",
                "Marrakech, Morocco",
                "From the buzz of the medina to silent desert dunes. Seven days of "
                        + "souks, riads, the Atlas Mountains and a night under the stars "
                        + "in a Sahara camp.",
                List.of(
                        departure(today.plusDays(28), 7, 1450.00, 14),
                        departure(today.plusDays(63), 7, 1390.00, 14),
                        departure(today.plusDays(105), 7, 1490.00, 12)
                )
        );

        seed(
                "Queenstown Adventure Week",
                "Queenstown, New Zealand",
                "Bungee jumps, jet boats and Milford Sound cruises in the adventure "
                        + "capital of the world. Six days of adrenaline balanced with "
                        + "lakeside wineries.",
                List.of(
                        departure(today.plusDays(40), 6, 2100.00, 12),
                        departure(today.plusDays(85), 6, 2200.00, 12)
                )
        );

        log.info(
                "Seeded {} packages and {} departures",
                packageRepository.count(),
                departureRepository.count()
        );
    }

    private void seed(
            String name,
            String destination,
            String description,
            List<PackageDeparture> departures
    ) {
        TravelPackage travelPackage = packageRepository.save(
                new TravelPackage(name, destination, description)
        );

        for (PackageDeparture departure : departures) {
            departure.setTravelPackage(travelPackage);
        }

        departureRepository.saveAll(departures);
    }

    private static PackageDeparture departure(
            LocalDate startDate,
            int nights,
            double price,
            int capacity
    ) {
        PackageDeparture departure = new PackageDeparture();
        departure.setStartDate(startDate);
        departure.setEndDate(startDate.plusDays(nights));
        departure.setPrice(price);
        departure.setCapacity(capacity);
        departure.setStatus(DepartureStatus.AVAILABLE);
        return departure;
    }
}
